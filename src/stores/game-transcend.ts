/**
 * game-transcend.ts：转生（奇点重启）协调（从 game.ts 拆出）。
 *
 * 转生门槛判定、收益预览与执行：终身计数采集对齐、跨 store 重置
 * 与保留项、初始能量加成、成就即时判定；返回契约与拆分前一致。
 */
import type { ComputedRef } from 'vue'
import type { Decimal } from '@/lib/decimal'
import { START_ENERGY } from './resources'
import type { useResourcesStore } from './resources'
import type { useBuildingsStore } from './buildings'
import type { useResearchStore } from './research'
import type { useMilitaryStore } from './military'
import type { useCombatStore } from './combat'
import type { useExplorationStore } from './exploration'
import type { useTranscendStore } from './transcend'
import type { useAchievementsStore } from './achievements'
import type { useDailyStore } from './daily'
import type { useEncountersStore } from './encounters'

type ResourcesStore = ReturnType<typeof useResourcesStore>
type BuildingsStore = ReturnType<typeof useBuildingsStore>
type ResearchStore = ReturnType<typeof useResearchStore>
type MilitaryStore = ReturnType<typeof useMilitaryStore>
type CombatStore = ReturnType<typeof useCombatStore>
type ExplorationStore = ReturnType<typeof useExplorationStore>
type TranscendStore = ReturnType<typeof useTranscendStore>
type AchievementsStore = ReturnType<typeof useAchievementsStore>
type DailyStore = ReturnType<typeof useDailyStore>
type EncountersStore = ReturnType<typeof useEncountersStore>

export interface GameTranscend {
  canTranscend: () => boolean
  previewTranscendGain: () => Decimal
  doTranscend: () => boolean
}

export function createGameTranscend(deps: {
  resources: ResourcesStore
  buildings: BuildingsStore
  research: ResearchStore
  military: MilitaryStore
  combat: CombatStore
  exploration: ExplorationStore
  transcend: TranscendStore
  achievements: AchievementsStore
  daily: DailyStore
  encounters: EncountersStore
  prestigeMult: ComputedRef<Decimal>
  collectLifetimeTotals: () => void
  alignLifetimeSnapshot: (toZero?: boolean) => void
}): GameTranscend {
  const {
    resources,
    buildings,
    research,
    military,
    combat,
    exploration,
    transcend,
    achievements,
    daily,
    encounters,
    prestigeMult,
    collectLifetimeTotals,
    alignLifetimeSnapshot,
  } = deps

  // 转生
  function canTranscend(): boolean {
    const totalEnergy = resources.getTotal('energy')
    const preview = transcend.previewNegEntropy(totalEnergy, prestigeMult.value)
    return preview.gte(1)
  }
  function previewTranscendGain(): Decimal {
    return transcend.previewNegEntropy(resources.getTotal('energy'), prestigeMult.value)
  }
  /**
   * 执行转生（奇点重启）
   *
   * 设计意图说明：
   * 转生后 resources.reset(true) 会重置 totals（历史总产出）为 0。
   * 这是设计意图而非 bug，放置类游戏的标准循环：
   *   每轮 run 积累能量 → 获得负熵 → 转生重置 → 新一轮 run
   * 如果 totals 不重置，玩家在后续 run 中无需任何努力即可获得大量负熵，
   * 破坏游戏平衡。previewNegEntropy 基于 getTotal('energy') 计算，
   * 重置后需要重新积累到 3e5 才能再次转生，符合预期。
   */
  function doTranscend(): boolean {
    const gain = previewTranscendGain()
    if (gain.lt(1)) return false
    // 成就终身计数：转生前先把本轮未采集的 totals 增量收进终身计数，
    // 再把快照归零对齐 reset 后的 totals（否则差值为负被钳掉，白丢一段计数）
    collectLifetimeTotals()
    alignLifetimeSnapshot(true)
    // 执行转生
    transcend.transcend(gain)
    daily.bump('transcends')
    // 重置非保留项
    resources.reset(true) // 保留暗物质
    buildings.reset()
    research.reset()
    military.reset()
    combat.reset() // 转生清驻扎/本轮通关，远征深度跨转生保留
    exploration.reset()
    encounters.reset() // 本轮数据：挂起与冷却窗口随转生清空
    // relics 保留
    // transcend 保留
    // 初始能量加成
    const startingMult = transcend.getValue('starting_energy')
    if (startingMult > 0) {
      resources.setAmount('energy', START_ENERGY * startingMult)
    }
    // 转生次数类成就即时判定（不等下一个 tick）
    achievements.checkAndUnlock()
    return true
  }

  return {
    canTranscend,
    previewTranscendGain,
    doTranscend,
  }
}
