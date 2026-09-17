/**
 * batch.ts — 批量操作通用骨架（v1.03 收敛）
 *
 * repeatUntilFail：×N 档位逐级执行原子操作，失败即停（买满语义）。
 * simulateSteps：×N 档位预览模拟，逐级取价 + 预算扣减，不触碰真实余额。
 * 三处批量函数（建筑升级/遗物强化/转生树购买）的执行与预览统一委托于此。
 */
import { D, type Decimal } from './decimal'

/** 重复执行 step 至多 steps 次，任一步失败即停，返回成功次数 */
export function repeatUntilFail(steps: number, step: () => boolean): number {
  let done = 0
  for (let i = 0; i < steps; i++) {
    if (!step()) break
    done++
  }
  return done
}

/**
 * 批量购买模拟：自 level 起逐级取价，预算够则模拟扣减并累计花费，
 * 预算不足或 canAdvance 拒绝（达上限）即停。
 * remain 会被就地扣减（调用方传副本）；成本键不在 remain 中视为免费跳过。
 */
export function simulateSteps(
  steps: number,
  level: number,
  nextCost: (level: number) => Record<string, number>,
  remain: Record<string, Decimal>,
  canAdvance: (level: number) => boolean
): { count: number; cost: Record<string, number> } {
  let count = 0
  const totals: Record<string, Decimal> = {}
  for (let i = 0; i < steps; i++) {
    if (!canAdvance(level)) break
    const cost = nextCost(level)
    let affordable = true
    for (const [k, v] of Object.entries(cost)) {
      const have = remain[k]
      if (have && !have.gte(v)) {
        affordable = false
        break
      }
    }
    if (!affordable) break
    for (const [k, v] of Object.entries(cost)) {
      if (k in remain) remain[k] = remain[k].minus(v)
      totals[k] = (totals[k] ?? D(0)).plus(v)
    }
    level++
    count++
  }
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(totals)) result[k] = v.toNumber()
  return { count, cost: result }
}
