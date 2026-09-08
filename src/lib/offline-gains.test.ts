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
    // 事件合金 ×30 到账，并计入 gains
    const alloyTotal = tracker.rows
      .filter((r) => r.res === 'alloy')
      .reduce((sum, r) => sum + r.amount, 0)
    expect(alloyTotal).toBe(3600 + 30)
    expect(report?.gains?.alloy).toBe('30')
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
    expect(report?.gains?.alloy).toBe('180')
    expect(report?.garrisonGains?.alloy).toBe('6000')
  })
})
