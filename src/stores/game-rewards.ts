/**
 * game-rewards.ts：跨系统奖励编排（从 game.ts 拆出）。
 *
 * 每日挑战领取、随机遭遇结算发放、派遣解锁同步与到点结算、
 * 远征里程碑领取；返回契约与拆分前一致。
 */
import { ref, type Ref } from 'vue'
import { D } from '@/lib/decimal'
import type { ResourceType } from '@/data/buildings'
import type { MilestoneReward } from '@/data/endless'
import type { EncounterResolution } from './encounters'
import type { useResourcesStore } from './resources'
import type { useMilitaryStore } from './military'
import type { useCombatStore } from './combat'
import type { useDailyStore } from './daily'
import type { useEncountersStore } from './encounters'

type ResourcesStore = ReturnType<typeof useResourcesStore>
type MilitaryStore = ReturnType<typeof useMilitaryStore>
type CombatStore = ReturnType<typeof useCombatStore>
type DailyStore = ReturnType<typeof useDailyStore>
type EncountersStore = ReturnType<typeof useEncountersStore>

export interface GameRewards {
  claimChallenge: (templateId: string) => { dark: number; streakBonus: number } | null
  resolveEncounter: (choice: 'A' | 'B') => EncounterResolution | null
  syncDispatchUnlocked: () => void
  settleDispatches: () => Record<string, Record<ResourceType, number>>
  lastDispatchResolution: Ref<Record<string, Record<ResourceType, number>> | null>
  claimMilestone: (tier: number) => MilestoneReward | null
}

export function createGameRewards(deps: {
  resources: ResourcesStore
  military: MilitaryStore
  combat: CombatStore
  daily: DailyStore
  encounters: EncountersStore
}): GameRewards {
  const { resources, military, combat, daily, encounters } = deps

  // 每日签到/周期挑战
  /** 挑战奖励发放（DailyCard 领取按钮回调） */
  function claimChallenge(templateId: string): { dark: number; streakBonus: number } | null {
    const result = daily.claim(templateId)
    if (!result) return null
    resources.gain('dark', result.dark)
    return result
  }

  // 随机遭遇事件（v1.26 可玩内容扩展方案 8），
  /**
   * 遭遇事件结算发放（EncounterCard 选项按钮回调）：encounters store 掷取
   * 结果后按奖励对象逐项发放，资源走 resources.gain（负值合金损失按余额
   * 封顶扣至空，不产生负库存）；units 走 military 库存直加（收编入伍不经训练
   * 队列、不占训练槽）。返回结算结果供 toast 回执，无挂起/已过期返回 null。
   */
  function resolveEncounter(choice: 'A' | 'B'): EncounterResolution | null {
    const result = encounters.resolve(choice)
    if (!result) return null
    const { rewards } = result
    for (const [key, value] of Object.entries(rewards)) {
      if (key === 'units') {
        if (value > 0) military.addToOwned('assault', value)
        continue
      }
      if (value < 0) {
        // 负值损失（仅合金）：按余额封顶扣减（至多扣空），不产生负库存
        const current = resources.getAmount(key as ResourceType)
        const loss = D(-value)
        resources.spend(key as ResourceType, loss.gt(current) ? current : loss)
        continue
      }
      resources.gain(key as ResourceType, value)
    }
    return result
  }

  // 派遣远征（v1.27 可玩内容扩展方案 6），
  /** 派遣解锁同步（tick 每秒调用）：远征开放即解锁派遣（本轮已攻克解锁锚点据点） */
  function syncDispatchUnlocked(): void {
    military.setDispatchUnlocked(combat.isEndlessUnlocked())
  }

  /** 派遣奖励发放：逐资源 resources.gain（纯资源包，无负值无兵员） */
  function grantDispatchReward(reward: Record<ResourceType, number>): void {
    for (const [key, value] of Object.entries(reward)) {
      if (value > 0) resources.gain(key as ResourceType, value)
    }
  }

  /** 派遣到点结算（tick 每秒调用）：发放并记录最近结算供 AppShell 回执 toast */
  const lastDispatchResolution = ref<Record<string, Record<ResourceType, number>> | null>(null)
  function settleDispatches(): Record<string, Record<ResourceType, number>> {
    const completed = military.collectCompletedDispatches(Date.now())
    const results: Record<string, Record<ResourceType, number>> = {}
    for (const [fid, r] of Object.entries(completed)) {
      grantDispatchReward(r.reward)
      results[fid] = r.reward
    }
    if (Object.keys(results).length > 0) lastDispatchResolution.value = results
    return results
  }

  // 远征里程碑（v1.20 可玩内容扩展方案 2），
  /** 里程碑奖励发放（MapView 领取按钮回调）：combat 记账成功后按奖励对象逐资源发放 */
  function claimMilestone(tier: number): MilestoneReward | null {
    const reward = combat.claimMilestone(tier)
    if (!reward) return null
    for (const [key, value] of Object.entries(reward)) {
      resources.gain(key as ResourceType, value as number)
    }
    return reward
  }

  return {
    claimChallenge,
    resolveEncounter,
    syncDispatchUnlocked,
    settleDispatches,
    lastDispatchResolution,
    claimMilestone,
  }
}
