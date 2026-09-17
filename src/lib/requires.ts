/**
 * requires.ts — 前置科技解锁判定（v1.03 收敛）
 *
 * 建筑/兵种的 `requires` 字段语义统一：缺省即解锁，否则前置科技须已完成。
 * buildings / military store 与 useActionQueue / OverviewPanel 内联共用。
 */

/** 无前置要求或前置已完成即解锁 */
export function isUnlockedBy(requires: string | undefined, completed: Set<string>): boolean {
  return !requires || completed.has(requires)
}
