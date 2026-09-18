/**
 * format.ts — 数值格式化与时间格式化
 */
import { Decimal } from './decimal'

const UNITS = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
  'TDc',
  'QaDc',
  'QiDc',
  'SxDc',
  'SpDc',
  'OcDc',
  'NoDc',
  'Vg',
]

/** 预计算的 1000 的幂次 Decimal 实例（避免 fmt 每次创建） */
const D_POWERS: Decimal[] = UNITS.map((_, i) => Decimal.pow(10, i * 3))

/** 数字 → 人类可读字符串（带字母后缀，挂机游戏标准格式） */
export function fmt(v: Decimal.Value, fixed = 2): string {
  // 单一路径（v0.95）：number 与 Decimal 入参统一走 Decimal 口径。
  // 原 number 快速路径为省实例而依赖引擎原生舍入，与全局 ROUND_DOWN
  // 截断不一致（同一数值按传参类型显示不同）
  const d = v instanceof Decimal ? v : new Decimal(v ?? 0)
  if (d.isNaN() || !d.isFinite()) return '0' // 非有限兜底（Infinity 等，v0.89）
  const abs = d.abs()
  if (abs.eq(0)) return '0'
  if (abs.lt(1000)) {
    // 小数分支在绝对值上格式化后补符号：负值朝零截断（不越单位边界），
    // 截断归零的极小负值不显负号（v0.95）
    let s: string
    if (abs.lt(10)) s = abs.toFixed(fixed).replace(/\.?0+$/, '') || '0'
    else if (abs.lt(100)) s = abs.toFixed(1).replace(/\.0$/, '')
    else s = abs.floor().toNumber().toString()
    return d.isNegative() && s !== '0' ? '-' + s : s
  }
  // 科学计数法太大时直接显示科学计数法
  const e = abs.log(10).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber()
  if (e >= UNITS.length * 3) {
    return sci(d)
  }
  const tier = Math.floor(e / 3)
  // 进位修正（v0.78）：scaled 达到 999.95 时必须升档
  // （例：999,999.5 应升为 1M；截断配置下进位后尾数恒为 1）
  const carry = abs.div(D_POWERS[tier]).gte(999.95)
  if (carry && tier + 1 >= UNITS.length) {
    return sci(d)
  }
  const idx = carry ? tier + 1 : tier
  const suffix = UNITS[idx]
  let s: string
  if (carry) {
    // 进位后 scaled ∈ [0.99995, 1)，显示精度下即 1
    s = '1'
  } else {
    const scaled = abs.div(D_POWERS[idx])
    if (scaled.gte(100)) s = scaled.toFixed(1)
    else s = scaled.toFixed(2)
    s = s.replace(/\.?0+$/, '')
  }
  return (d.lt(0) ? '-' : '') + s + suffix
}

/** 超档科学计数法（去尾零，v0.95；如 1e66 / 1.5e66） */
function sci(d: Decimal): string {
  const [mant, exp] = d.toExponential(2).split('e')
  const m = mant.replace(/\.?0+$/, '') || '0'
  return m + 'e' + exp.replace('+', '')
}

/** 秒 → 友好时间（如 "2h 30m"） */
export function fmtTime(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '0s'
  if (seconds < 60) return Math.floor(seconds) + 's'
  const m = Math.floor(seconds / 60)
  if (m < 60) return m + 'm ' + Math.floor(seconds % 60) + 's'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ' + (m % 60) + 'm'
  const d = Math.floor(h / 24)
  return d + 'd ' + (h % 24) + 'h'
}

/** 每秒产量格式化 "+1.2K /s"；零产出显示 "0 /s"（组件与按钮设计规范 §1.4） */
export function fmtRate(v: Decimal.Value): string {
  const d = v instanceof Decimal ? v : new Decimal(v)
  if (d.isZero()) return '0 /s'
  return (d.lt(0) ? '' : '+') + fmt(d) + ' /s'
}

/** 时间戳/日期 → 本地时间串（默认 'YYYY-MM-DD HH:mm'；dateOnly 时 'YYYY-MM-DD'） */
export function fmtDate(ts: number | Date, opts: { dateOnly?: boolean } = {}): string {
  const d = ts instanceof Date ? ts : new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return opts.dateOnly ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
