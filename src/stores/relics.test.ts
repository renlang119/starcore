/**
 * relics.test.ts — 遗物合成/套装测试（v0.61 玩法扩展方案 6）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRelicsStore } from './relics'
import { setRelicEnhanceSpendProvider } from './relics'
import {
  RELIC_POOL,
  RELIC_SETS,
  getRelicById,
  getSetByRelic,
  MAX_RELIC_LEVEL,
  enhanceCost,
  enhanceValue,
  enhanceLabel,
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

describe('relics — 强化（v0.70）', () => {
  let store: ReturnType<typeof useRelicsStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRelicsStore()
    // 重置模块级 provider，防止跨测试污染（slotProvider 同款先例）
    setRelicEnhanceSpendProvider(() => true)
  })

  it('enhanceValue：正向放大与折扣加深统一公式', () => {
    expect(enhanceValue(1.05, 0.04, 20)).toBeCloseTo(1.09, 10)
    expect(enhanceValue(1.4, 0.04, 20)).toBeCloseTo(1.72, 10)
    expect(enhanceValue(1.3, 0.04, 20)).toBeCloseTo(1.54, 10)
    expect(enhanceValue(2.0, 0.01, 20)).toBeCloseTo(2.2, 10)
    expect(enhanceValue(0.9, 0.01, 20)).toBeCloseTo(0.88, 10)
    // Lv0 = 无变化
    expect(enhanceValue(1.4, 0.04, 0)).toBeCloseTo(1.4, 10)
  })

  it('enhanceCost：base×growth^(Lv-1)，单调递增且跨稀有度分档', () => {
    expect(enhanceCost('common', 1)).toBe(1e6)
    expect(enhanceCost('common', 2)).toBe(1.5e6)
    expect(enhanceCost('rare', 1)).toBe(5e6)
    expect(enhanceCost('epic', 1)).toBe(2.5e7)
    expect(enhanceCost('legendary', 1)).toBe(1.25e8)
    expect(enhanceCost('legendary', 20)).toBe(Math.ceil(1.25e8 * Math.pow(1.5, 19)))
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      for (let lv = 2; lv <= MAX_RELIC_LEVEL; lv++) {
        expect(enhanceCost(r, lv)).toBeGreaterThan(enhanceCost(r, lv - 1))
      }
    }
  })

  it('enhanceLabel：±N% 与 ×N 形态替换', () => {
    expect(enhanceLabel('能量产出 +5%', 1.05, 0.04, 20)).toBe('能量产出 +9%')
    expect(enhanceLabel('能量产出 +40%', 1.4, 0.04, 20)).toBe('能量产出 +72%')
    expect(enhanceLabel('攻击力 +30%', 1.3, 0.04, 20)).toBe('攻击力 +54%')
    expect(enhanceLabel('科技成本 -10%', 0.9, 0.01, 20)).toBe('科技成本 -12%')
    expect(enhanceLabel('转生负熵 ×2', 2.0, 0.01, 20)).toBe('转生负熵 ×2.2')
    expect(enhanceLabel('转生负熵 +50%', 1.5, 0.01, 20)).toBe('转生负熵 +60%')
  })

  it('enhance：扣能量 level+1；成本随等级递增', () => {
    const spent: number[] = []
    setRelicEnhanceSpendProvider((c) => {
      spent.push(c)
      return true
    })
    const inst = inject(store, 'r_energy_1')[0]
    expect(store.enhance(inst)).toBe(true)
    expect(store.enhance(inst)).toBe(true)
    expect(store.owned[0].level).toBe(2)
    expect(spent).toEqual([1e6, 1.5e6])
  })

  it('enhance：余额不足（spend 返回 false）零副作用', () => {
    setRelicEnhanceSpendProvider(() => false)
    const inst = inject(store, 'r_energy_1')[0]
    expect(store.enhance(inst)).toBe(false)
    expect(store.owned[0].level).toBe(0)
  })

  it('enhance：满级与不存在实例拒绝', () => {
    const inst = inject(store, 'r_energy_1')[0]
    for (let i = 0; i < MAX_RELIC_LEVEL; i++) expect(store.enhance(inst)).toBe(true)
    expect(store.owned[0].level).toBe(MAX_RELIC_LEVEL)
    expect(store.enhance(inst)).toBe(false)
    expect(store.enhance('relic_not_exist')).toBe(false)
  })

  it('nextEnhanceCost：未满级返回成本，满级返回 null', () => {
    const inst = inject(store, 'r_energy_1')[0]
    expect(store.nextEnhanceCost(inst)).toBe(1e6)
    for (let i = 0; i < MAX_RELIC_LEVEL; i++) store.enhance(inst)
    expect(store.nextEnhanceCost(inst)).toBeNull()
    expect(store.nextEnhanceCost('relic_not_exist')).toBeNull()
  })

  it('equippedEffects：强化放大装备效果值并更新 label；套装加成不随强化变化', () => {
    // 遗物：r_energy_3（epic 能量 +40%）+ r_data_1（common 数据 +5%，沉默者套装凑件）
    const ids = [...inject(store, 'r_energy_3'), ...inject(store, 'r_dark_1')]
    store.equip(ids[0], 0)
    store.equip(ids[1], 1)
    expect(store.getMult('production_mult', 'energy')).toBeCloseTo(1.4, 10)

    // 强化 r_energy_3 至 Lv5：1.4 → 1 + 0.4×(1+0.04×5) = 1.48
    for (let i = 0; i < 5; i++) store.enhance(ids[0])
    const enhanced = store.equippedEffects.find(
      (e) => e.type === 'production_mult' && e.target === 'energy'
    )!
    expect(enhanced.value).toBeCloseTo(1.48, 10)
    expect(enhanced.label).toBe('能量产出 +48%')
    // Lv20 不改变套装加成叠加逻辑（加成项本身不变）
    expect(store.getMult('production_mult', 'energy')).toBeCloseTo(1.48, 10)
  })

  it('enhance 不影响同 id 其他实例', () => {
    const ids = inject(store, 'r_energy_1', 2)
    store.enhance(ids[0])
    const a = store.owned.find((r) => r.instanceId === ids[0])!
    const b = store.owned.find((r) => r.instanceId === ids[1])!
    expect(a.level).toBe(1)
    expect(b.level).toBe(0)
  })

  it('serialize/hydrate：level 往返；旧档无 level 默认 0 且上限钳制', () => {
    const inst = inject(store, 'r_energy_1')[0]
    store.enhance(inst)
    store.enhance(inst)
    const data = store.serialize()
    expect(data.owned[0].level).toBe(2)

    setActivePinia(createPinia())
    const other = useRelicsStore()
    other.hydrate(data)
    expect(other.owned[0].level).toBe(2)

    // 旧档（无 level 字段）
    const legacy = { ...data, owned: [{ id: 'r_energy_1', instanceId: 'x', obtainedAt: 1 }] }
    setActivePinia(createPinia())
    const legacyStore = useRelicsStore()
    legacyStore.hydrate(legacy as typeof data)
    expect(legacyStore.owned[0].level).toBe(0)

    // 越界防御：level 超出上限被钳制
    const over = {
      ...data,
      owned: [{ id: 'r_energy_1', instanceId: 'y', obtainedAt: 1, level: 99 }],
    }
    setActivePinia(createPinia())
    const overStore = useRelicsStore()
    overStore.hydrate(over as typeof data)
    expect(overStore.owned[0].level).toBe(MAX_RELIC_LEVEL)
  })
})

describe('relics — 批量强化（v0.86）', () => {
  let store: ReturnType<typeof useRelicsStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRelicsStore()
    setRelicEnhanceSpendProvider(() => true)
  })

  it('enhanceSteps 全额预算：steps 级全部完成，扣费与连点一致', () => {
    const spent: number[] = []
    setRelicEnhanceSpendProvider((c) => {
      spent.push(c)
      return true
    })
    const inst = inject(store, 'r_energy_1')[0]
    const done = store.enhanceSteps(inst, 3)
    expect(done).toBe(3)
    expect(store.owned[0].level).toBe(3)
    // 普通遗物基础 1e6、每级 ×1.5：1e6 / 1.5e6 / 2.25e6
    expect(spent).toEqual([1e6, 1.5e6, 2.25e6])
  })

  it('enhanceSteps 预算中途耗尽：买到买不起为止，返回实际级数', () => {
    const costs: number[] = []
    setRelicEnhanceSpendProvider((c) => {
      costs.push(c)
      // 仅前两次放行，第三次起拒付（模拟能量耗尽）
      return costs.length <= 2
    })
    const inst = inject(store, 'r_energy_1')[0]
    const done = store.enhanceSteps(inst, 100)
    expect(done).toBe(2)
    expect(store.owned[0].level).toBe(2)
  })

  it('enhanceSteps 达 20 级上限自然截断（×100 一键拉满）', () => {
    const inst = inject(store, 'r_energy_1')[0]
    const done = store.enhanceSteps(inst, 100)
    expect(done).toBe(MAX_RELIC_LEVEL)
    expect(store.owned[0].level).toBe(MAX_RELIC_LEVEL)
  })

  it('enhanceSteps 一级都买不起：返回 0；steps=1 与单次等价', () => {
    setRelicEnhanceSpendProvider(() => false)
    const inst = inject(store, 'r_energy_1')[0]
    expect(store.enhanceSteps(inst, 10)).toBe(0)
    expect(store.owned[0].level).toBe(0)
    setRelicEnhanceSpendProvider(() => true)
    expect(store.enhanceSteps(inst, 1)).toBe(1)
  })
})
