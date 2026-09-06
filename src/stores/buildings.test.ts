/**
 * buildings.test.ts — 建筑 store 与成本曲线测试
 * 覆盖：初始等级 / upgrade / getCost 公式 / 产出计算 / 解锁判定 /
 * reset / serialize-hydrate / 数值规范守恒断言（docs/游戏数值设定规范.md §三）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBuildingsStore } from './buildings'
import { BUILDINGS, buildingCost, getBuilding } from '@/data/buildings'
import { D } from '@/lib/decimal'

describe('buildings — 初始状态与升级', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('20 建筑全部初始 0 级', () => {
    const b = useBuildingsStore()
    expect(BUILDINGS).toHaveLength(20)
    for (const def of BUILDINGS) expect(b.getLevel(def.id)).toBe(0)
  })

  it('upgrade 逐级 +1；未知 id 拒绝', () => {
    const b = useBuildingsStore()
    expect(b.upgrade('solar_collector')).toBe(true)
    expect(b.upgrade('solar_collector')).toBe(true)
    expect(b.getLevel('solar_collector')).toBe(2)
    expect(b.upgrade('不存在的建筑')).toBe(false)
  })

  it('setLevel 直接设定等级', () => {
    const b = useBuildingsStore()
    b.setLevel('fusion_reactor', 10)
    expect(b.getLevel('fusion_reactor')).toBe(10)
  })

  it('bySector 按扇区分组，五扇区各 4 建筑', () => {
    const b = useBuildingsStore()
    for (const s of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
      expect(b.bySector(s)).toHaveLength(4)
    }
  })
})

describe('buildings — 成本公式 ceil(base × growth^level)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('L0 成本 = baseCost（取整后原值）', () => {
    const b = useBuildingsStore()
    const cost = b.getCost('solar_collector')
    expect(cost.energy).toBe(10)
  })

  it('多资源成本逐资源同因子放大', () => {
    const b = useBuildingsStore()
    b.setLevel('fusion_reactor', 2) // 200×1.15²=264.5→265, 50×1.15²=66.125→67
    const cost = b.getCost('fusion_reactor')
    expect(cost.energy).toBe(265)
    expect(cost.crystal).toBe(67)
  })

  it('高等级大数成本（decimal 通道精度）', () => {
    const def = getBuilding('dyson_swarm')!
    const cost = buildingCost(def, 200) // 50000×1.1^200 ≈ 9.2e12
    expect(cost.energy).toBeGreaterThan(9e12)
    expect(cost.energy).toBeLessThan(1e13)
    expect(Number.isInteger(cost.energy)).toBe(true) // ceil 取整
  })

  it('getCost 未知 id 返回空对象', () => {
    const b = useBuildingsStore()
    expect(b.getCost('nope')).toEqual({})
  })

  it('成本随等级严格递增（全部 20 建筑抽样验证）', () => {
    for (const def of BUILDINGS) {
      const c0 = buildingCost(def, 0)
      const c10 = buildingCost(def, 10)
      const c100 = buildingCost(def, 100)
      for (const res of Object.keys(c0)) {
        expect(c10[res]).toBeGreaterThan(c0[res])
        expect(c100[res]).toBeGreaterThan(c10[res])
      }
    }
  })
})

describe('buildings — 产出计算', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('0 级建筑无产出（空对象）', () => {
    const b = useBuildingsStore()
    expect(b.getProduction('solar_collector', { energy: D(1) })).toEqual({})
  })

  it('产出 = 每级产出 × 等级 × 全局乘数', () => {
    const b = useBuildingsStore()
    b.setLevel('solar_collector', 10)
    const prod = b.getProduction('solar_collector', { energy: D(2) })
    expect(prod.energy!.toNumber()).toBe(10) // 0.5×10×2
  })

  it('getTotalProduction 汇总全部建筑，五资源键齐全', () => {
    const b = useBuildingsStore()
    b.setLevel('solar_collector', 10)
    b.setLevel('crystal_mine', 5)
    const mults = { energy: D(1), crystal: D(1), alloy: D(1), data: D(1), dark: D(1) }
    const total = b.getTotalProduction(mults)
    expect(Object.keys(total).sort()).toEqual(['alloy', 'crystal', 'dark', 'data', 'energy'])
    expect(total.energy!.toNumber()).toBe(5) // 0.5×10
    expect(total.crystal!.toNumber()).toBeCloseTo(1.5) // 0.3×5
    expect(total.alloy!.toNumber()).toBe(0)
  })

  it('乘数按资源独立生效（晶体乘数不影响能量）', () => {
    const b = useBuildingsStore()
    b.setLevel('solar_collector', 10)
    const mults = { energy: D(3), crystal: D(10), alloy: D(1), data: D(1), dark: D(1) }
    const total = b.getTotalProduction(mults)
    expect(total.energy!.toNumber()).toBe(15)
  })
})

describe('buildings — 解锁判定', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('无 requires 的建筑恒解锁', () => {
    const b = useBuildingsStore()
    expect(b.isUnlocked(getBuilding('solar_collector')!, new Set())).toBe(true)
  })

  it('有 requires 的建筑须科技完成才解锁', () => {
    const b = useBuildingsStore()
    const fusion = getBuilding('fusion_reactor')!
    expect(b.isUnlocked(fusion, new Set())).toBe(false)
    expect(b.isUnlocked(fusion, new Set(['fusion_tech']))).toBe(true)
    expect(b.isUnlocked(fusion, new Set(['other_tech']))).toBe(false)
  })
})

describe('buildings — reset / serialize / hydrate', () => {
  it('reset 全建筑归零', () => {
    setActivePinia(createPinia())
    const b = useBuildingsStore()
    b.setLevel('solar_collector', 50)
    b.reset()
    expect(b.getLevel('solar_collector')).toBe(0)
  })

  it('serialize/hydrate 往返一致', () => {
    setActivePinia(createPinia())
    const b = useBuildingsStore()
    b.setLevel('dyson_swarm', 12)
    b.setLevel('crystal_mine', 7)
    const data = b.serialize()

    setActivePinia(createPinia())
    const b2 = useBuildingsStore()
    b2.hydrate(data)
    expect(b2.getLevel('dyson_swarm')).toBe(12)
    expect(b2.getLevel('crystal_mine')).toBe(7)
    expect(b2.getLevel('solar_collector')).toBe(0)
  })

  it('hydrate 忽略已移除建筑的残留键（按 BUILDINGS 白名单恢复）', () => {
    setActivePinia(createPinia())
    const b = useBuildingsStore()
    b.hydrate({ levels: { solar_collector: 3, ghost_building: 99 } })
    expect(b.getLevel('solar_collector')).toBe(3)
    expect(b.getLevel('ghost_building')).toBe(0) // 未定义建筑保持 0
  })

  it('hydrate(undefined) 不改变现状', () => {
    setActivePinia(createPinia())
    const b = useBuildingsStore()
    b.hydrate(undefined)
    expect(b.getLevel('solar_collector')).toBe(0)
  })
})

describe('buildings — 数值规范守恒（docs/游戏数值设定规范.md §三）', () => {
  /** 每扇区按 tier 排序的建筑（tier 1-4 各一） */
  function byTier(sector: string) {
    return BUILDINGS.filter((b) => b.sector === sector).sort((a, b) => a.tier - b.tier)
  }

  /** 主产出（每建筑 produces 只有单资源键） */
  function mainOutput(def: (typeof BUILDINGS)[number]): number {
    const values = Object.values(def.produces).filter((v): v is number => v !== undefined)
    expect(values).toHaveLength(1)
    return values[0]
  }

  it('成本增长率阶梯：T1=1.18 / T2=1.15 / T3=1.13 / T4=1.10（全扇区一致）', () => {
    const GROWTH = [1.18, 1.15, 1.13, 1.1]
    for (const sector of ['energy', 'crystal', 'alloy', 'data', 'dark']) {
      const layers = byTier(sector)
      expect(layers.map((l) => l.tier)).toEqual([1, 2, 3, 4])
      layers.forEach((l, i) => expect(l.costGrowth).toBe(GROWTH[i]))
    }
  })

  it('每级产出比 ≥ ×2（陷阱层防线：任何相邻层产出不得持平或倒退）', () => {
    for (const sector of ['energy', 'crystal', 'alloy', 'data', 'dark']) {
      const layers = byTier(sector)
      for (let i = 0; i < layers.length - 1; i++) {
        const ratio = mainOutput(layers[i + 1]) / mainOutput(layers[i])
        expect(ratio, `${sector} T${i + 1}→T${i + 2}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('跳层无倒挂：同扇区 L0 能量回本逐层单调不减（能量口径）', () => {
    for (const sector of ['energy', 'crystal', 'alloy', 'data', 'dark']) {
      const layers = byTier(sector)
      const payback = layers.map((l) => (l.baseCost.energy ?? 0) / mainOutput(l))
      for (let i = 0; i < payback.length - 1; i++) {
        expect(payback[i + 1], `${sector} T${i + 1}→T${i + 2}`).toBeGreaterThanOrEqual(payback[i])
      }
    }
  })

  it('离子铸造站口径（v0.65 修正后）：每级合金 1.2，T2→T3 = ×4', () => {
    const ion = getBuilding('ion_casting_plant')!
    expect(ion.produces.alloy).toBe(1.2)
    const nano = getBuilding('nano_forge')!
    expect(ion.produces.alloy! / nano.produces.alloy!).toBeCloseTo(4)
  })

  it('全部建筑 tier 为 1-4 且 icon 引用 i- 前缀 symbol', () => {
    for (const def of BUILDINGS) {
      expect(def.tier).toBeGreaterThanOrEqual(1)
      expect(def.tier).toBeLessThanOrEqual(4)
      expect(def.icon.startsWith('i-')).toBe(true)
    }
  })
})
