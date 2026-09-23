/**
 * game-effects.ts — 主 store 的效果系统与全局乘数（从 game.ts 拆出）。
 *
 * 统一效果系统注册、全局乘数 computed、生产缓存与自动化开关派生，
 * 以及各 store 的一次性依赖注入（槽位扩展 / 强化支出通道 / 成就外部
 * 指标 / 训练并行槽 / 驻扎前置守卫）。返回契约与拆分前一致。
 */
import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { Decimal } from '@/lib/decimal'
import { EffectSystem, type EffectSource } from '@/lib/effect-system'
import { setTrainingSlotProvider, MAX_TRAINING_SLOTS } from './military'
import {
  setRelicSlotProvider,
  setRelicEnhanceSpendProvider,
  setRelicSynthCountProvider,
} from './relics'
import { setAchievementExternalProviders } from './achievements'
import { setGarrisonGuard } from './combat'
import { getStronghold } from '@/data/pve'
import type { useResourcesStore } from './resources'
import type { useRelicsStore } from './relics'
import type { useTranscendStore } from './transcend'
import type { useResearchStore } from './research'
import type { useAchievementsStore } from './achievements'
import type { useBuildingsStore } from './buildings'
import type { useMilitaryStore } from './military'
import type { useCombatStore } from './combat'
import type { useExplorationStore } from './exploration'

type ResourcesStore = ReturnType<typeof useResourcesStore>
type RelicsStore = ReturnType<typeof useRelicsStore>
type TranscendStore = ReturnType<typeof useTranscendStore>
type ResearchStore = ReturnType<typeof useResearchStore>
type AchievementsStore = ReturnType<typeof useAchievementsStore>
type BuildingsStore = ReturnType<typeof useBuildingsStore>
type MilitaryStore = ReturnType<typeof useMilitaryStore>
type CombatStore = ReturnType<typeof useCombatStore>
type ExplorationStore = ReturnType<typeof useExplorationStore>

export interface GameEffects {
  effectSystem: EffectSystem
  productionMults: ComputedRef<Record<string, Decimal>>
  atkMult: ComputedRef<Decimal>
  defMult: ComputedRef<Decimal>
  exploreMult: ComputedRef<Decimal>
  prestigeMult: ComputedRef<Decimal>
  offlineMult: ComputedRef<Decimal>
  techCostMult: ComputedRef<Decimal>
  autoBuild: ComputedRef<boolean>
  autoResearch: ComputedRef<boolean>
  autoExplore: ComputedRef<boolean>
  totalProduction: ComputedRef<Record<string, Decimal>>
}

/** 统一效果系统（6.2：替代三处重复 getMax 逻辑）与全局乘数缓存 */
export function createGameEffects(deps: {
  research: ResearchStore
  relics: RelicsStore
  transcend: TranscendStore
  achievements: AchievementsStore
  buildings: BuildingsStore
}): GameEffects {
  const { research, relics, transcend, achievements, buildings } = deps

  const effectSystem = new EffectSystem()
  // 各 store 通过 getMult/getValue 接口注册为 EffectSource
  effectSystem.register(research as EffectSource)
  effectSystem.register(relics as EffectSource)
  effectSystem.register(transcend as EffectSource)
  effectSystem.register(achievements as EffectSource)

  // —— 计算全局乘数（5.1：改为 computed 缓存，仅在依赖变化时重算）——
  const productionMults = computed<Record<string, Decimal>>(() => {
    const result: Record<string, Decimal> = {}
    for (const res of ['energy', 'crystal', 'alloy', 'data', 'dark']) {
      result[res] = effectSystem.getMult('production_mult', res)
    }
    return result
  })

  const atkMult = computed(() => effectSystem.getMult('combat_mult', 'attack'))
  const defMult = computed(() => effectSystem.getMult('combat_mult', 'defense'))
  const exploreMult = computed(() => effectSystem.getMult('explore_mult'))
  const prestigeMult = computed(() => effectSystem.getMult('prestige_mult'))
  const offlineMult = computed(() => effectSystem.getMult('offline_bonus'))
  const techCostMult = computed(() => effectSystem.getMult('cost_mult', 'tech'))
  // —— 自动化 QoL 开关（转生树买断节点；getValue 累加通道 > 0 即已购）——
  const autoBuild = computed(() => effectSystem.getValue('auto_build') > 0)
  const autoResearch = computed(() => effectSystem.getValue('auto_research') > 0)
  const autoExplore = computed(() => effectSystem.getValue('auto_explore') > 0)

  /** 5.2：缓存总产出——仅当建筑等级或乘数变化时重算 */
  const totalProduction = computed(() => buildings.getTotalProduction(productionMults.value))

  return {
    effectSystem,
    productionMults,
    atkMult,
    defMult,
    exploreMult,
    prestigeMult,
    offlineMult,
    techCostMult,
    autoBuild,
    autoResearch,
    autoExplore,
    totalProduction,
  }
}

/** 各 store 的一次性依赖注入（须在主 store setup 阶段调用一次） */
export function wireGameProviders(deps: {
  effectSystem: EffectSystem
  resources: ResourcesStore
  relics: RelicsStore
  transcend: TranscendStore
  combat: CombatStore
  military: MilitaryStore
  exploration: ExplorationStore
  totalPlayTime: Ref<number>
  /** v1.21 周挑战扩类：合成计数通道注入（daily.bump） */
  daily?: ReturnType<typeof import('./daily').useDailyStore>
}): void {
  const { effectSystem, resources, relics, transcend, combat, military, exploration } = deps

  // 修复：显式注入槽位扩展依赖，避免 relics store setup 阶段隐式引用 transcend
  setRelicSlotProvider(() => transcend.getValue('relic_slot'))
  // 强化能量支出通道：接入 resources.spend 原子扣费
  setRelicEnhanceSpendProvider((cost) => resources.spend('energy', cost))
  // 合成计数通道（v1.21 周挑战扩类）：合成成功计入周挑战（可选注入，测试环境缺省无操作）
  if (deps.daily) {
    const daily = deps.daily
    setRelicSynthCountProvider(() => daily.bump('synths'))
  }
  // 成就的外部现值指标（遗物/转生数本身跨转生保留，无需终身计数）
  setAchievementExternalProviders({
    relicsOwned: () => relics.ownedCount,
    relicKinds: () => relics.ownedKinds,
    transcends: () => transcend.totalTranscends,
    playtime: () => deps.totalPlayTime.value,
    expeditionBest: () => combat.expeditionBest,
  })
  // 训练并行槽：基础 1 槽 + 科技加成（集群操练 I/II 各 +1），封顶 MAX_TRAINING_SLOTS
  setTrainingSlotProvider(() =>
    Math.min(MAX_TRAINING_SLOTS, 1 + effectSystem.getValue('training_slot'))
  )
  // 驻扎前置守卫：据点须解锁（探索前置完成）+ 编队存在且未被其他据点占用。
  // 据点已攻克门槛由 combat.garrison 本体校验（completedStrongholds 属 combat 自身状态）
  setGarrisonGuard((strongholdId, formationId) => {
    const def = getStronghold(strongholdId)
    if (!def) return false
    if (!exploration.prereqMet(def.requires)) return false
    const f = military.formations.find((f) => f.id === formationId)
    if (!f) return false
    for (const [sid, g] of Object.entries(combat.garrisoned)) {
      if (sid !== strongholdId && g.formationId === formationId) return false
    }
    return true
  })
}
