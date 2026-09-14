/**
 * offline-gains.test.ts — 离线收益与随机事件（v0.78）
 *
 * 固化随机事件契约：建筑产出与驻扎产出任一存在即可触发；
 * 事件基准取建筑产出，无建筑产出时回退驻扎每秒产出。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeOfflineGains, type OfflineGainsDeps } from './offline-gains'
import { D, type Decimal } from './decimal'

function makeDeps(overrides: Partial<OfflineGainsDeps> = {}): OfflineGainsDeps {
  return {
    totalProduction: {},
    offlineMult: D(1),
    garrisoned: {},
    garrisonIdleReward: () => ({}),
    gainResource: () => {},
    advanceTraining: () => ({}),
    ...overrides,
  }
}

/** 记录到账明细，便于断言事件增益 */
function trackGains() {
  const rows: Array<{ res: string; amount: number }> = []
  const gainResource = (res: string, amount: number | Decimal) => {
    rows.push({ res, amount: D(amount).toNumber() })
  }
  return { rows, gainResource }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeOfflineGains 随机事件（v0.78）', () => {
  it('纯驻扎挂机（无建筑产出）也能摇到事件并到账', () => {
    // 第 1 次 random：事件判定 0.1 < 0.2；第 2 次 random：取 alloy 事件（index 2）
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.7)
    const tracker = trackGains()
    const report = computeOfflineGains(
      3600,
      makeDeps({
        garrisoned: { silencer_1: {} },
        garrisonIdleReward: () => ({ alloy: 1 }),
        gainResource: tracker.gainResource,
      })
    )
    expect(report).not.toBeNull()
    // 驻扎基础收益：1/s × 3600s
    expect(report?.garrisonGains?.alloy).toBe('3600')
    // 事件合金 ×30 到账，并单列 eventGains（v0.93 前并入 gains）
    const alloyTotal = tracker.rows
      .filter((r) => r.res === 'alloy')
      .reduce((sum, r) => sum + r.amount, 0)
    expect(alloyTotal).toBe(3600 + 30)
    expect(report?.eventGains?.alloy).toBe('30')
  })

  it('建筑产出存在时事件基准取建筑产出（不回退驻扎）', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.7)
    const tracker = trackGains()
    const report = computeOfflineGains(
      60,
      makeDeps({
        totalProduction: { alloy: D(2) },
        garrisoned: { s1: {} },
        garrisonIdleReward: () => ({ alloy: 100 }),
        gainResource: tracker.gainResource,
      })
    )
    // 建筑 2/s × 60 = 120；驻扎 100/s × 60 = 6000；事件基准 = 建筑 2 × 30 = 60
    expect(report?.gains?.alloy).toBe('120')
    expect(report?.garrisonGains?.alloy).toBe('6000')
    // v0.93：事件收益单列 eventGains，不再并入 gains（旧断言 180 = 120+60 随之改）
    expect(report?.eventGains?.alloy).toBe('60')
  })
})

describe('computeOfflineGains 训练队列补推进', () => {
  it('离线跨训练完成：报告含 trainedUnits 且与返回值一致', () => {
    const report = computeOfflineGains(
      3600,
      makeDeps({
        advanceTraining: () => ({ assault: 2 }),
      })
    )
    expect(report).not.toBeNull()
    expect(report?.trainedUnits).toEqual({ assault: 2 })
  })

  it('advanceTraining 返回空对象：报告不含 trainedUnits 字段', () => {
    const report = computeOfflineGains(3600, makeDeps({ advanceTraining: () => ({}) }))
    expect(report).not.toBeNull()
    expect(report).not.toHaveProperty('trainedUnits')
  })

  it('无训练任务时不推进队列（advanceTraining 未被调用则无字段）', () => {
    const report = computeOfflineGains(3600, makeDeps())
    expect(report).not.toBeNull()
    expect(report).not.toHaveProperty('trainedUnits')
  })
})

describe('computeOfflineGains 随机事件分支与守卫', () => {
  it('random >= 0.2 不触发事件：报告无 eventGains 字段', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9)
    const report = computeOfflineGains(
      3600,
      makeDeps({
        totalProduction: { energy: D(1) },
      })
    )
    expect(report).not.toBeNull()
    expect(report?.gains?.energy).toBe('3600')
    expect(report).not.toHaveProperty('eventGains')
  })

  it('NaN / Infinity / 负值：入口守卫返回 null（不推进训练队列）', () => {
    let called = 0
    const deps = makeDeps({ advanceTraining: () => (called++, {}) })
    expect(computeOfflineGains(Number.NaN, deps)).toBeNull()
    expect(computeOfflineGains(Number.POSITIVE_INFINITY, deps)).toBeNull()
    expect(computeOfflineGains(-100, deps)).toBeNull()
    expect(called).toBe(0)
  })
})
