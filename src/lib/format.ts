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

/** 整数千分位 */
export function fmtInt(v: number | Decimal.Value): string {
  const n = typeof v === 'number' ? v : new Decimal(v).toNumber()
  if (!isFinite(n) || isNaN(n)) return '0'
  return Math.floor(n).toLocaleString('en-US')
}

/** 百分比；NaN/Infinity 兜底为 0（v0.78）；负零归一（v0.95） */
export function pct(v: number | Decimal.Value, fixed = 1): string {
  const n = typeof v === 'number' ? v : new Decimal(v).toNumber()
  if (!isFinite(n)) return (0).toFixed(fixed) + '%'
  const s = (n * 100).toFixed(fixed)
  // 四舍五入归零的负值不带负号（如 -0.0001 → 0.0%）
  const zero = (0).toFixed(fixed)
  return (s === '-' + zero ? zero : s) + '%'
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

/**
 * 秒 → 倒计时格式化（带"约"前缀，精确到分钟）
 * @param seconds 预估秒数
 * @param bottleneckName 瓶颈资源名称（可选），如传入则追加"（名称）"
 * @returns 如 "约5h23m后（木材）"
 */
export function fmtCountdown(seconds: number, bottleneckName?: string): string {
  if (!isFinite(seconds) || seconds < 0) return ''
  const suffix = bottleneckName ? `（${bottleneckName}）` : ''
  if (seconds < 60) return `约<1m后${suffix}`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `约${m}m后${suffix}`
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h < 24) {
    const mPart = remM > 0 ? `${remM}m` : ''
    return `约${h}h${mPart}后${suffix}`
  }
  const d = Math.floor(h / 24)
  const remH = h % 24
  if (d < 30) {
    const hPart = remH > 0 ? `${remH}h` : ''
    return `约${d}d${hPart}后${suffix}`
  }
  return `约${d}d后${suffix}`
}
