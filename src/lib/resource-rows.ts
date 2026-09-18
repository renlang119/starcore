import { fmt } from './format'
import { Decimal } from './decimal'

/** 展示行：资源 id → 名称 / 颜色 / 金额（fmt 格式化） */
export interface ResourceRow {
  id: string
  name: string
  color: string
  amount: string
}

/**
 * resourceRows — 资源字典 → 展示行（v1.07 收敛自离线报告 / 战报 / 星图 / 顶栏四处组装）
 *
 * 名称与颜色查 meta 表，缺失时回退 id / '#fff'；金额统一走 fmt 管线。
 * positiveOnly 时仅保留正值条目（战报与驻扎收益等过滤零值场景）。
 */
export function resourceRows(
  dict: Record<string, Decimal.Value>,
  metaMap: Record<string, { name?: string; color?: string } | undefined>,
  opts: { positiveOnly?: boolean } = {}
): ResourceRow[] {
  const rows: ResourceRow[] = []
  for (const [id, v] of Object.entries(dict)) {
    if (opts.positiveOnly) {
      const positive = v instanceof Decimal ? v.gt(0) : Number(v) > 0
      if (!positive) continue
    }
    const meta = metaMap[id]
    rows.push({ id, name: meta?.name ?? id, color: meta?.color ?? '#fff', amount: fmt(v) })
  }
  return rows
}
