/**
 * dispatch.test.ts — 派遣远征数据层（v1.27 可玩内容扩展方案 6）
 *
 * 数值口径与 EV 核验表同源：
 * - 权重表 4/8/12/24h → 1.0/2.2/3.6/8.0，每小时费率单调不减
 * - 奖励 = round(base × 1.35^(max(1,best)-1) × w × traitMult)，键面恒五资源
 * - 召回 = round(全额 × t/H)，t=H 全额，反复短派无套利
 * - 基准包 = silencer_3 奖励五资源（真值直读数据表，不硬编码防漂移）
 */
import { describe, it, expect } from 'vitest'
import {
  DISPATCH_TIERS,
  getDispatchTier,
  dispatchRewardScale,
  dispatchTraitMult,
  dispatchReward,
  dispatchRecallReward,
} from './dispatch'
import { getTrait, DEFAULT_TRAIT_ID } from './traits'
import { STRONGHOLDS } from './pve'

const BASE = STRONGHOLDS.find((s) => s.id === 'silencer_3')!
const KEYS = ['energy', 'crystal', 'alloy', 'data', 'dark'] as const

describe('dispatch · 档位表', () => {
  it('四档定稿：4/8/12/24h → 权重 1.0/2.2/3.6/8.0', () => {
    expect(DISPATCH_TIERS.map((t) => [t.hours, t.weight])).toEqual([
      [4, 1.0],
      [8, 2.2],
      [12, 3.6],
      [24, 8.0],
    ])
    expect(DISPATCH_TIERS.every((t) => typeof t.label === 'string' && t.label.length > 0)).toBe(
      true
    )
  })

  it('每小时费率单调不减（长派严格优于拆短派的结构前提）', () => {
    for (let i = 1; i < DISPATCH_TIERS.length; i++) {
      const prev = DISPATCH_TIERS[i - 1].weight / DISPATCH_TIERS[i - 1].hours
      const cur = DISPATCH_TIERS[i].weight / DISPATCH_TIERS[i].hours
      expect(cur).toBeGreaterThanOrEqual(prev)
    }
  })

  it('getDispatchTier：合法档位命中、非法时长 undefined', () => {
    expect(getDispatchTier(8)?.weight).toBe(2.2)
    expect(getDispatchTier(5)).toBeUndefined()
    expect(getDispatchTier(0)).toBeUndefined()
    expect(getDispatchTier(-4)).toBeUndefined()
  })
})

describe('dispatch · 奖励公式', () => {
  it('best=1 即基准包原样（rs=1, w=1, 均衡）', () => {
    const r = dispatchReward(1, 1.0, DEFAULT_TRAIT_ID)
    for (const k of KEYS) {
      expect(r[k]).toBe(Math.round(BASE.rewards[k] as number))
    }
  })

  it('层缩放 = 1.35^(best-1)，best 钳 1，非有限回 1', () => {
    expect(dispatchRewardScale(1)).toBeCloseTo(1)
    expect(dispatchRewardScale(11) / dispatchRewardScale(10)).toBeCloseTo(1.35)
    expect(dispatchRewardScale(0)).toBe(dispatchRewardScale(1))
    expect(dispatchRewardScale(-5)).toBe(1)
    expect(dispatchRewardScale(NaN)).toBe(1)
  })

  it('档位权重线性放大（best=10, 24h = 4h 的 8 倍）', () => {
    const r4 = dispatchReward(10, 1.0, DEFAULT_TRAIT_ID)
    const r24 = dispatchReward(10, 8.0, DEFAULT_TRAIT_ID)
    for (const k of KEYS) {
      // 各资源独立 round，与 8 倍精确值的偏差 = |round(x·8) − 8·round(x)| ≤ 8
      // （w=1 与 w=8 两次取整的最大错位；dark 小数值 ×8000 当量下同样成立）
      expect(Math.abs(r24[k] - r4[k] * 8)).toBeLessThanOrEqual(8)
    }
  })

  it('后勤特性 ×1.2 后置作用，其余特性 1.0', () => {
    expect(dispatchTraitMult('logistics_doctrine')).toBeCloseTo(
      getTrait('logistics_doctrine').garrisonMult
    )
    expect(dispatchTraitMult(undefined)).toBe(1)
    expect(dispatchTraitMult('assault_doctrine')).toBe(1)
    const base = dispatchReward(5, 2.2, 'balanced')
    const logi = dispatchReward(5, 2.2, 'logistics_doctrine')
    for (const k of KEYS) {
      expect(logi[k]).toBe(
        Math.round((BASE.rewards[k] as number) * dispatchRewardScale(5) * 2.2 * 1.2)
      )
      expect(logi[k]).toBeGreaterThanOrEqual(base[k])
    }
  })

  it('奖励键面恒为五资源（基础包遗物概率字段不混入）', () => {
    const r = dispatchReward(25, 3.6, 'logistics_doctrine')
    expect(Object.keys(r).sort()).toEqual([...KEYS].sort())
  })
})

describe('dispatch · 提前召回', () => {
  it('t=H 全额结算', () => {
    const full = dispatchReward(10, 2.2, DEFAULT_TRAIT_ID)
    const recalled = dispatchRecallReward(10, 8, 2.2, 8, DEFAULT_TRAIT_ID)
    for (const k of KEYS) expect(recalled[k]).toBe(full[k])
  })

  it('半程召回 ≈ 全额一半（round 误差 ≤1）', () => {
    const full = dispatchReward(10, 2.2, DEFAULT_TRAIT_ID)
    const half = dispatchRecallReward(10, 8, 2.2, 4, DEFAULT_TRAIT_ID)
    for (const k of KEYS) expect(Math.abs(half[k] - full[k] / 2)).toBeLessThanOrEqual(1)
  })

  it('t 钳 [0, H]：未出发零奖励、超时不超全额', () => {
    const zero = dispatchRecallReward(10, 12, 3.6, -1, DEFAULT_TRAIT_ID)
    const over = dispatchRecallReward(10, 12, 3.6, 99, DEFAULT_TRAIT_ID)
    const full = dispatchReward(10, 3.6, DEFAULT_TRAIT_ID)
    for (const k of KEYS) {
      expect(zero[k]).toBe(0)
      expect(over[k]).toBe(full[k])
    }
  })

  it('召回无套利：任意时长 t 的结算 ≤ 同档全额（比例封顶）', () => {
    for (let t = 0; t <= 24; t += 0.5) {
      const r = dispatchRecallReward(10, 24, 8.0, t, DEFAULT_TRAIT_ID)
      const full = dispatchReward(10, 8.0, DEFAULT_TRAIT_ID)
      for (const k of KEYS) expect(r[k]).toBeLessThanOrEqual(full[k])
    }
  })
})
