/**
 * format.ts — 数值格式化与时间格式化
 */
import { Decimal } from './decimal'

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg']

/** 预计算的 1000 的幂次 Decimal 实例（避免 fmt 每次创建） */
const D_POWERS: Decimal[] = UNITS.map((_, i) => Decimal.pow(10, i * 3))

/** 数字 → 人类可读字符串（带字母后缀，挂机游戏标准格式） */
export function fmt(v: Decimal.Value, fixed = 2): string {
  // 快速路径：number 类型直接处理，避免创建 Decimal 实例
  if (typeof v === 'number') {
    if (isNaN(v)) return '0'
    if (v === 0) return '0'
    if (v > 0 && v < 1000) {
      if (v < 10) return v.toFixed(fixed).replace(/\.?0+$/, '') || '0'
      if (v < 100) return v.toFixed(1).replace(/\.0$/, '')
      return Math.floor(v).toString()
    }
    if (v < 0 && v > -1000) {
      if (v > -10) return v.toFixed(fixed).replace(/\.?0+$/, '') || '0'
      if (v > -100) return v.toFixed(1).replace(/\.0$/, '')
      return Math.floor(v).toString()
    }
  }
  // Decimal 路径：跳过重复创建
  const d = v instanceof Decimal ? v : new Decimal(v ?? 0)
  if (d.isNaN()) return '0'
  const abs = d.abs()
  if (abs.lt(1000)) {
    if (abs.eq(0)) return '0'
    if (abs.lt(10)) return d.toFixed(fixed).replace(/\.?0+$/, '') || '0'
    if (abs.lt(100)) return d.toFixed(1).replace(/\.0$/, '')
    return Math.floor(d.toNumber()).toString()
  }
  // 科学计数法太大时直接显示科学计数法
  const e = abs.log(10).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber()
  if (e >= UNITS.length * 3) {
    return d.toExponential(2).replace('e+', 'e')
  }
  const tier = Math.floor(e / 3)
  const suffix = UNITS[tier]
  const scaled = abs.div(D_POWERS[tier])
  let s: string
  if (scaled.gte(100)) s = scaled.toFixed(1)
  else if (scaled.gte(10)) s = scaled.toFixed(2)
  else s = scaled.toFixed(2)
  s = s.replace(/\.?0+$/, '')
  return (d.lt(0) ? '-' : '') + s + suffix
}

/** 整数千分位 */
export function fmtInt(v: number | Decimal.Value): string {
  const n = typeof v === 'number' ? v : new Decimal(v).toNumber()
  if (!isFinite(n) || isNaN(n)) return '0'
  return Math.floor(n).toLocaleString('en-US')
}

/** 百分比 */
export function pct(v: number | Decimal.Value, fixed = 1): string {
  const n = typeof v === 'number' ? v : new Decimal(v).toNumber()
  return (n * 100).toFixed(fixed) + '%'
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

/** 每秒产量格式化 "+1.2K/s" */
export function fmtRate(v: Decimal.Value): string {
  return (v instanceof Decimal && v.lt(0) ? '' : '+') + fmt(v) + '/s'
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
