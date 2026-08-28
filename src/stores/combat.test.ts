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
})
