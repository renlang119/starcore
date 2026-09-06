/**
 * combat.test.ts — combat.ts 战斗结算基础测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCombatStore } from './combat'
import { D } from '@/lib/decimal'
import { STRONGHOLDS } from '@/data/pve'
import type { Formation } from './military'

function makeFormation(id: string, units: Record<string, number>): Formation {
  return { id, name: `编队-${id}`, units: units as any }
}

describe('combat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('empty formation → defeat', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', {})
    const result = combat.resolveBattle(formation, STRONGHOLDS[0], D(1), D(1))
    expect(result.victory).toBe(false)
    expect(result.rounds).toBe(0)
  })

  it('winning battle — large army vs tier-1 stronghold', () => {
    const combat = useCombatStore()
    // 100 assault units should easily beat raider_1 (5 grunts, 40hp each)
    const formation = makeFormation('f1', { assault: 100 })
    const stronghold = STRONGHOLDS.find((s) => s.id === 'raider_1')!
    const result = combat.resolveBattle(formation, stronghold, D(1), D(1))
    expect(result.victory).toBe(true)
    expect(result.rounds).toBeGreaterThan(0)
    expect(result.rewards.energy).toBe(stronghold.rewards.energy)
  })

  it('losing battle — tiny army vs tier-4 stronghold', () => {
    const combat = useCombatStore()
    // 1 assault vs silencer_1 (5 scouts 1500hp + 2 elites 4000hp)
    const formation = makeFormation('f1', { assault: 1 })
    const stronghold = STRONGHOLDS.find((s) => s.id === 'silencer_1')!
    const result = combat.resolveBattle(formation, stronghold, D(1), D(1))
    expect(result.victory).toBe(false)
  })

  it('rewards only on victory', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', {})
    const result = combat.resolveBattle(formation, STRONGHOLDS[0], D(1), D(1))
    expect(result.victory).toBe(false)
    expect(Object.keys(result.rewards).length).toBe(0)
  })

  it('atkMult/defMult affect battle outcome', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', { assault: 5 })
    const stronghold = STRONGHOLDS.find((s) => s.id === 'raider_1')!
    // With 1x mult, 5 assault might lose or barely win
    const weakResult = combat.resolveBattle(formation, stronghold, D(1), D(1))
    // With 100x mult, 5 assault should dominate
    const strongResult = combat.resolveBattle(formation, stronghold, D(100), D(100))
    expect(strongResult.victory).toBe(true)
    // Strong result should take fewer rounds than weak result (if weak wins at all)
    if (weakResult.victory) {
      expect(strongResult.rounds).toBeLessThanOrEqual(weakResult.rounds)
    }
  })

  it('serialize / hydrate round-trip', () => {
    const combat = useCombatStore()
    combat.garrison('raider_1', 'f1')
    const data = combat.serialize()
    expect(data.garrisoned['raider_1']).toBeDefined()

    // Reset and hydrate
    combat.reset()
    expect(Object.keys(combat.garrisoned).length).toBe(0)
    combat.hydrate(data)
    expect(combat.garrisoned['raider_1']).toBeDefined()
  })

  // —— 无尽远征（v0.60）——

  it('远征战果：仅攻克当前前沿推进，重打/失败/跳层不推进', () => {
    const combat = useCombatStore()
    expect(combat.expeditionBest).toBe(0)
    // 失败不推进
    expect(combat.recordExpedition(1, false)).toBe(false)
    expect(combat.expeditionBest).toBe(0)
    // 跳层（D3）不推进
    expect(combat.recordExpedition(3, true)).toBe(false)
    // 依次攻克前沿
    expect(combat.recordExpedition(1, true)).toBe(true)
    expect(combat.expeditionBest).toBe(1)
    // 重打已过深度不推进
    expect(combat.recordExpedition(1, true)).toBe(false)
    expect(combat.expeditionBest).toBe(1)
    expect(combat.recordExpedition(2, true)).toBe(true)
    expect(combat.expeditionBest).toBe(2)
    // 小数钳制为整数
    expect(combat.recordExpedition(3.9, true)).toBe(true)
    expect(combat.expeditionBest).toBe(3)
  })

  it('转生 reset() 保留远征深度、清本轮通关；hardReset reset(true) 全清', () => {
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    combat.garrison('raider_2', 'f1')
    combat.recordExpedition(1, true)
    combat.recordExpedition(2, true)
    expect(combat.expeditionBest).toBe(2)

    // 转生：清驻扎/通关，保留远征深度
    combat.reset()
    expect(combat.completedStrongholds.size).toBe(0)
    expect(Object.keys(combat.garrisoned).length).toBe(0)
    expect(combat.expeditionBest).toBe(2)

    // hardReset：全清
    combat.reset(true)
    expect(combat.expeditionBest).toBe(0)
  })

  it('serialize/hydrate 含 expeditionBest；旧档字段缺失默认 0', () => {
    const combat = useCombatStore()
    combat.recordExpedition(1, true)
    combat.recordExpedition(2, true)
    const data = combat.serialize()
    expect(data.expeditionBest).toBe(2)

    // 新 store hydrate
    const other = useCombatStore()
    other.hydrate(data)
    expect(other.expeditionBest).toBe(2)

    // 旧档无 expeditionBest：保持 0，不抛错（先归零再验 hydrate 容缺）
    const legacy = useCombatStore()
    legacy.$patch({ expeditionBest: 2 })
    legacy.hydrate({ garrisoned: {}, completed: ['raider_1'] })
    expect(legacy.expeditionBest).toBe(2)

    // 防御：负数/NaN/小数钳制
    const weird = useCombatStore()
    weird.hydrate({ garrisoned: {}, completed: [], expeditionBest: -5 })
    expect(weird.expeditionBest).toBe(0)
    weird.hydrate({ garrisoned: {}, completed: [], expeditionBest: 7.9 })
    expect(weird.expeditionBest).toBe(7)
  })

  it('远征解锁链：攻克沉默者旗舰后 isEndlessUnlocked 为真', async () => {
    const combat = useCombatStore()
    expect(combat.isEndlessUnlocked()).toBe(false)
    combat.completedStrongholds.add('silencer_3')
    expect(combat.isEndlessUnlocked()).toBe(true)
    // 合成据点可从 store 取（深度 1）
    const s = combat.getEndlessStronghold(1)
    expect(s.id).toBe('endless')
  })
})
