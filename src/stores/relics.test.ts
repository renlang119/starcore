/**
 * relics.test.ts — 遗物合成/套装测试（v0.61 玩法扩展方案 6）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRelicsStore } from './relics'
import {
  RELIC_POOL,
  RELIC_SETS,
  getRelicById,
  getSetByRelic,
  type RelicDef,
  type RelicRarity,
} from '../data/relics'

/** 注入指定 id 的遗物（走 obtain 通道，instanceId 唯一） */
function inject(store: ReturnType<typeof useRelicsStore>, relicId: string, times = 1) {
  const def = getRelicById(relicId)!
  const instances: string[] = []
  for (let i = 0; i < times; i++) instances.push(store.obtain(def).instanceId)
  return instances
}

/** 取某稀有度任意 n 件未装备遗物（不重复注入） */
function injectN(store: ReturnType<typeof useRelicsStore>, rarity: RelicRarity, n: number) {
  const ids: string[] = []
  for (const r of RELIC_POOL) {
    if (r.rarity !== rarity) continue
    const def = r as RelicDef
    ids.push(store.obtain(def).instanceId)
    if (ids.length === n) break
  }
  return ids
}

describe('relics — 套装数据完整性', () => {
  it('4 组套装覆盖全部 20 件遗物，无重复无遗漏', () => {
    const members = RELIC_SETS.flatMap((s) => s.memberIds)
    expect(members).toHaveLength(20)
    expect(new Set(members).size).toBe(20)
    for (const id of members) expect(getRelicById(id)).toBeDefined()
    expect(new Set(RELIC_POOL.map((r) => r.id))).toEqual(new Set(members))
  })

  it('满套成员至少 3 件（可触发满套）', () => {
    for (const s of RELIC_SETS) expect(s.memberIds.length).toBeGreaterThanOrEqual(3)
  })

  it('getSetByRelic 映射正确', () => {
    expect(getSetByRelic('r_silence')!.id).toBe('silencer')
    expect(getSetByRelic('r_omega')!.id).toBe('silencer')
    expect(getSetByRelic('不存在的id')).toBeUndefined()
  })
})

describe('relics — 合成', () => {
  let store: ReturnType<typeof useRelicsStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRelicsStore()
  })

  it('3 件同稀有度未装备 → 高一档随机产物', () => {
    const mats = injectN(store, 'common', 3)
    const before = store.ownedCount
    const product = store.synthesize(mats, () => 0) // rng 固定取池首
    expect(product).not.toBeNull()
    expect(product!.rarity).toBe('rare')
    expect(store.ownedCount).toBe(before - 2) // -3 材料 +1 产物
  })

  it('产物在目标稀有度池内且为新实例', () => {
    const mats = injectN(store, 'rare', 3)
    const product = store.synthesize(mats)
    expect(product!.rarity).toBe('epic')
    expect(['r_energy_3', 'r_data_3', 'r_dark_3', 'r_combat_3', 'r_prestige_1']).toContain(
      product!.id
    )
    expect(mats.includes(product!.instanceId)).toBe(false)
  })

  it('不足 3 件拒绝；重复 instanceId 拒绝', () => {
    const mats = injectN(store, 'common', 2)
    expect(store.synthesize(mats)).toBeNull()
    expect(store.synthesize([...mats, mats[0]])).toBeNull()
    expect(store.ownedCount).toBe(2) // 无变动
  })

  it('稀有度混选拒绝', () => {
    const a = inject(store, 'r_energy_1') // common
    const b = inject(store, 'r_energy_2') // rare
    const c = inject(store, 'r_data_1') // common
    expect(store.synthesize([...a, ...b, ...c])).toBeNull()
    expect(store.ownedCount).toBe(3)
  })

  it('已装备遗物作材料拒绝', () => {
    const mats = injectN(store, 'common', 3)
    store.equip(mats[0], 0)
    expect(store.synthesize(mats)).toBeNull()
    expect(store.ownedCount).toBe(3)
  })

  it('legendary 不可作材料（顶档）', () => {
    const a = inject(store, 'r_energy_1')
    const b = inject(store, 'r_data_1')
    const c = inject(store, 'r_omega') // legendary
    expect(store.synthesize([...a, ...b, ...c])).toBeNull()
    expect(store.ownedCount).toBe(3)
  })

  it('不存在/已被消耗的 instanceId 拒绝', () => {
    const mats = injectN(store, 'common', 3)
    mats[2] = 'relic_fake_123'
    expect(store.synthesize(mats)).toBeNull()
    // 已消耗：合成后原 instanceId 不复存在
    const real = injectN(store, 'common', 3)
    store.synthesize(real)
    expect(store.synthesize(real)).toBeNull()
  })

  it('连续合成：common → rare → epic 逐级跳', () => {
    const m1 = injectN(store, 'common', 3)
    const p1 = store.synthesize(m1)!
    expect(p1.rarity).toBe('rare')
    const m2 = injectN(store, 'rare', 2).concat(p1.instanceId)
    const p2 = store.synthesize(m2)!
    expect(p2.rarity).toBe('epic')
  })
})

describe('relics — 套装加成', () => {
  let store: ReturnType<typeof useRelicsStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRelicsStore()
  })

  it('装备 2 件沉默者系 → partial 加成进入 equippedEffects', () => {
    const ids = [...inject(store, 'r_dark_1'), ...inject(store, 'r_dark_2')]
    store.equip(ids[0], 0)
    store.equip(ids[1], 1)
    const row = store.setProgress.find((r) => r.set.id === 'silencer')!
    expect(row.count).toBe(2)
    expect(row.mode).toBe('partial')
    expect(store.equippedEffects.some((e) => e.label.includes('暗物质产出 +6%'))).toBe(true)
  })

  it('装备 3 件同系 → full 加成（partial 不叠加）', () => {
    const ids = [
      ...inject(store, 'r_dark_1'),
      ...inject(store, 'r_dark_2'),
      ...inject(store, 'r_dark_3'),
    ]
    ids.forEach((id, i) => store.equip(id, i))
    const row = store.setProgress.find((r) => r.set.id === 'silencer')!
    expect(row.mode).toBe('full')
    const labels = store.equippedEffects.map((e) => e.label)
    expect(labels.some((l) => l.includes('暗物质产出 +12%'))).toBe(true)
    expect(labels.some((l) => l.includes('暗物质产出 +6%'))).toBe(false)
  })

  it('卸下后套装失活', () => {
    const ids = [...inject(store, 'r_dark_1'), ...inject(store, 'r_dark_2')]
    store.equip(ids[0], 0)
    store.equip(ids[1], 1)
    store.unequip(1)
    const row = store.setProgress.find((r) => r.set.id === 'silencer')!
    expect(row.mode).toBe('none')
    expect(store.equippedEffects.some((e) => e.label.includes('套装'))).toBe(false)
  })

  it('getMult 聚合套装加成（效果通道一致）', () => {
    const ids = [
      ...inject(store, 'r_dark_1'),
      ...inject(store, 'r_dark_2'),
      ...inject(store, 'r_dark_3'),
    ]
    ids.forEach((id, i) => store.equip(id, i))
    // r_dark_1(1.05) × r_dark_2(1.15) × r_dark_3(1.4) × 满套(1.12)
    const expected = 1.05 * 1.15 * 1.4 * 1.12
    expect(store.getMult('production_mult', 'dark')).toBeCloseTo(expected, 10)
  })

  it('ownedKinds 按种类去重', () => {
    inject(store, 'r_dark_1', 3) // 同 id 3 件
    inject(store, 'r_energy_1', 1)
    expect(store.ownedCount).toBe(4)
    expect(store.ownedKinds).toBe(2)
  })
})

describe('relics — 存档兼容', () => {
  it('合成产物可 serialize/hydrate 往返', () => {
    setActivePinia(createPinia())
    const store = useRelicsStore()
    const mats = injectN(store, 'common', 3)
    const product = store.synthesize(mats)!
    const data = store.serialize()
    expect(data.owned).toHaveLength(1)
    expect(data.owned[0].id).toBe(product.id)

    setActivePinia(createPinia())
    const other = useRelicsStore()
    other.hydrate(data)
    expect(other.ownedCount).toBe(1)
    expect(other.owned[0].id).toBe(product.id)
    expect(other.owned[0].effects).toEqual(product.effects)
  })
})
