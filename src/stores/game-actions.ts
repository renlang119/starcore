/**
 * game-actions.ts：原子操作与自动化协议（从 game.ts 拆出）。
 *
 * 建筑升级与科技研究的「检查 + 扣费 + 执行」原子操作、批量预览，
 * 以及建造 / 研究 / 探索三协议自动化；返回契约与拆分前一致。
 */
import type { ComputedRef } from 'vue'
import type { Decimal } from '@/lib/decimal'
import { repeatUntilFail, simulateSteps } from '@/lib/batch'
import { TECHS, adjustedTechCost } from '@/data/tech'
import { BUILDINGS, buildingCost } from '@/data/buildings'
import { enhanceCost, MAX_RELIC_LEVEL } from '@/data/relics'
import type { useResourcesStore } from './resources'
import type { useBuildingsStore } from './buildings'
import type { useResearchStore } from './research'
import type { useRelicsStore } from './relics'
import type { useAchievementsStore } from './achievements'
import type { useDailyStore } from './daily'
import type { useExplorationStore } from './exploration'

type ResourcesStore = ReturnType<typeof useResourcesStore>
type BuildingsStore = ReturnType<typeof useBuildingsStore>
type ResearchStore = ReturnType<typeof useResearchStore>
type RelicsStore = ReturnType<typeof useRelicsStore>
type AchievementsStore = ReturnType<typeof useAchievementsStore>
type DailyStore = ReturnType<typeof useDailyStore>
type ExplorationStore = ReturnType<typeof useExplorationStore>

export interface GameActions {
  tryUpgradeBuilding: (id: string) => boolean
  tryUpgradeBuildingSteps: (id: string, steps: number) => number
  previewUpgradeBuildingSteps: (
    id: string,
    steps: number
  ) => { count: number; cost: Record<string, number> }
  previewRelicEnhanceSteps: (instanceId: string, steps: number) => number
  tryResearch: (id: string) => boolean
  runAutomation: () => void
}

export function createGameActions(deps: {
  resources: ResourcesStore
  buildings: BuildingsStore
  research: ResearchStore
  relics: RelicsStore
  achievements: AchievementsStore
  daily: DailyStore
  exploration: ExplorationStore
  techCostMult: ComputedRef<Decimal>
  exploreMult: ComputedRef<Decimal>
  autoBuild: ComputedRef<boolean>
  autoResearch: ComputedRef<boolean>
  autoExplore: ComputedRef<boolean>
}): GameActions {
  const {
    resources,
    buildings,
    research,
    relics,
    achievements,
    daily,
    exploration,
    techCostMult,
    exploreMult,
    autoBuild,
    autoResearch,
    autoExplore,
  } = deps

  // 原子操作（check + spend + execute 一体化，消除竞态），
  /**
   * 尝试升级建筑：原子检查资源 + 扣费 + 升级
   * 替代视图中 canAfford → spendCost → upgrade 的三步非原子调用
   */
  function tryUpgradeBuilding(id: string): boolean {
    const def = BUILDINGS.find((b) => b.id === id)
    if (!def) return false // 未知建筑 id：失败路径不记账不扣费
    if (buildings.isMaxed(id)) return false // 已达等级上限：与视图/队列/预览共用同一门槛
    const cost = buildings.getCost(id)
    if (!resources.spendCost(cost)) return false // spendCost 内部已含 canAfford 检查
    buildings.upgrade(id)
    achievements.recordUpgrade(buildings.getLevel(id))
    daily.bump('upgrades')
    return true
  }

  /**
   * 批量升级预览：返回当前资源下点击一次批量升级的实际
   * 可买级数与逐级累计总花费。逐级取价与扣费模拟同 tryUpgradeBuilding
   * 的实扣顺序一致（资源不足或达等级上限自然停止，最多 steps 级），
   * 供 ×N>1 档位在成本行展示「可买级数 + 预计总花费」。
   */
  function previewUpgradeBuildingSteps(
    id: string,
    steps: number
  ): { count: number; cost: Record<string, number> } {
    const def = BUILDINGS.find((b) => b.id === id)
    if (!def || steps < 1) return { count: 0, cost: {} }
    return simulateSteps(
      steps,
      buildings.getLevel(id),
      (level) => buildingCost(def, level),
      { ...resources.amounts },
      (level) => !buildings.isMaxed(id, level)
    )
  }

  /**
   * 批量强化预览：返回当前能量下点击一次批量强化的实际可完成级数。
   * 逐级按新等级取价，能量不足或达 MAX_RELIC_LEVEL 上限自然停止，最多 steps 级；
   * 取价与扣费顺序同 relics.enhanceSteps，供按钮文案按实际级数显示。
   */
  function previewRelicEnhanceSteps(instanceId: string, steps: number): number {
    const relic = relics.owned.find((r) => r.instanceId === instanceId)
    if (!relic || steps < 1) return 0
    return simulateSteps(
      steps,
      relic.level,
      (level) => ({ energy: enhanceCost(relic.rarity, level + 1) }),
      { energy: resources.getAmount('energy') },
      (level) => level < MAX_RELIC_LEVEL
    ).count
  }

  /**
   * 批量升级建筑：至多 steps 级、买满语义。
   * 内部逐级复用 tryUpgradeBuilding 原子操作，等级/成就/周挑战记账
   * 粒度与连点完全一致；买不起下一级或已满级自然停止。
   */
  function tryUpgradeBuildingSteps(id: string, steps: number): number {
    return repeatUntilFail(steps, () => tryUpgradeBuilding(id))
  }

  /**
   * 尝试研究科技：原子检查资源 + 扣费 + 完成
   */
  function tryResearch(id: string): boolean {
    const def = TECHS.find((t) => t.id === id)
    if (!def) return false
    const adjustedCost = adjustedTechCost(def.cost, techCostMult.value.toNumber())
    if (!research.available(def)) return false
    if (!resources.spendCost(adjustedCost)) return false
    research.complete(id)
    achievements.recordResearch()
    daily.bump('researches')
    return true
  }

  /**
   * 自动化 QoL：每 tick 一遍，三种协议独立开关。
   * - 建造协议：按 BUILDINGS 数据序扫描已解锁建筑，买得起即升 1 级（每建筑每 tick 至多 1 级）
   * - 研究协议：按 TECHS 数据序扫描可用科技，买得起即完成（含 techCostMult，与手动一致）
   * - 探索协议：availableNodes 已挡完成/进行中/前置，逐个尝试开始（与 MapView 手动同路径）
   * 购买策略 = 买得起即买，不留储备。单遍扫描 20 建筑/59 科技/34 节点，开销可忽略。
   */
  function runAutomation(): void {
    if (autoBuild.value) {
      for (const b of BUILDINGS) {
        // isUnlocked 查 b.requires（科技 id），须传已完成科技集合；
        // 误传 unlock 效果目标派生的集合会使两集合永不相交，建筑永不自动升级
        if (!buildings.isUnlocked(b, research.completed)) continue
        tryUpgradeBuilding(b.id)
      }
    }
    if (autoResearch.value) {
      for (const def of TECHS) {
        if (!research.available(def)) continue
        tryResearch(def.id)
      }
    }
    if (autoExplore.value) {
      for (const node of exploration.availableNodes()) {
        exploration.startExplore(
          node.id,
          exploreMult.value,
          (c) => resources.canAfford(c),
          (c) => resources.spendCost(c)
        )
      }
    }
  }

  return {
    tryUpgradeBuilding,
    tryUpgradeBuildingSteps,
    previewUpgradeBuildingSteps,
    previewRelicEnhanceSteps,
    tryResearch,
    runAutomation,
  }
}
