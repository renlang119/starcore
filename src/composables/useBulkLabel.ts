/**
 * useBulkLabel — 批量操作按钮文案（v1.00 定型口径，v1.07 自建造/转生/强化三处收敛）
 *
 * 段位 ×N 且实际可完成级数 >0 时显示「base ×N」（随资源动态变化）；
 * 一级都买不起时退回 base（按钮同时处于禁用态，成本行另有「可买 0 级」）。
 * 输出为 v086 脚本与单测的硬断言文案，逐字敏感。
 */
export function bulkLabel(baseText: string, count: number): string {
  return count > 0 ? `${baseText} ×${count}` : baseText
}
