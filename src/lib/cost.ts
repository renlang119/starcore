/**
 * cost.ts — 成本曲线工具（v1.08）
 *
 * 「升档取整」单一数学口径：遗物强化成本与转生树无限节点成本两处共用。
 */

/** ceil(base × growth^exponent)：指数成本升档取整，防小数成本 */
export function ceilPow(base: number, growth: number, exponent: number): number {
  return Math.ceil(base * Math.pow(growth, exponent))
}
