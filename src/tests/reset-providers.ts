/**
 * src/tests/reset-providers.ts — isolate:false 下模块级单例 provider 的集中重置
 *
 * 背景（v0.93）：vitest isolate:false 跨文件共享 worker，
 * 5 个模块级 provider（military.trainingSlotProvider / relics.slotProvider /
 * relics.enhanceSpend / combat.garrisonGuard / achievements.externalProviders）
 * 持有「创建它的那次 pinia」里的 store 闭包；任何测试文件注入后，后续文件
 * 读到的是已废弃 pinia 的旧闭包。前靠 6 个测试文件里 8 处散落的手工重置
 * 兜底，存在盲点（relics.test 的合成/套装组不重置 enhanceSpend）。
 *
 * 本文件由 vitest.config.ts 的 setupFiles 挂载，每个测试文件开始前把全部
 * provider 恢复默认值（同各 store 模块声明处的初始默认）。测试内注入的
 * provider 只在本文件内有效，跨文件不再泄漏——散落的手工重置不再是
 * 正确性的必要条件（保留无害）。
 *
 * 注意：achievements.externalProviders 无 setter 全清接口，这里用
 * setAchievementExternalProviders 注入全 0 桩达到同等效果（未注入指标
 * 按 0 判定，是 store 的既有语义）；garrisonGuard 走 resetGarrisonGuard
 * 显式清空（未注入时 garrison 本体门槛仍生效，是既有语义）。
 */
import { setTrainingSlotProvider, BASE_TRAINING_SLOTS } from '@/stores/military'
import {
  setRelicSlotProvider,
  setRelicEnhanceSpendProvider,
  setRelicEnhanceDoneProvider,
} from '@/stores/relics'
import { resetGarrisonGuard, resetFormationTraitProvider } from '@/stores/combat'
import { setAchievementExternalProviders } from '@/stores/achievements'

/** 恢复全部模块级 provider 为各 store 声明处的默认值 */
export function resetProviderSingletons(): void {
  setTrainingSlotProvider(() => BASE_TRAINING_SLOTS)
  setRelicSlotProvider(() => 0)
  setRelicEnhanceSpendProvider(() => false)
  setRelicEnhanceDoneProvider(() => {})
  resetGarrisonGuard()
  resetFormationTraitProvider()
  setAchievementExternalProviders({
    relicsOwned: () => 0,
    relicKinds: () => 0,
    enemyKinds: () => 0,
    activeFullSets: () => 0,
    transcends: () => 0,
    playtime: () => 0,
    expeditionBest: () => 0,
  })
}

/** 成就外部指标全零桩 + 按需覆盖（achievements.test 七处字面量重复的收敛，v1.04） */
export function zeroAchievementProviders(
  overrides?: Partial<
    Record<
      | 'relicsOwned'
      | 'relicKinds'
      | 'enemyKinds'
      | 'activeFullSets'
      | 'transcends'
      | 'playtime'
      | 'expeditionBest',
      () => number
    >
  >
): void {
  setAchievementExternalProviders({
    relicsOwned: () => 0,
    relicKinds: () => 0,
    enemyKinds: () => 0,
    activeFullSets: () => 0,
    transcends: () => 0,
    playtime: () => 0,
    expeditionBest: () => 0,
    ...overrides,
  })
}

resetProviderSingletons()
