/**
 * format.test.ts — format.ts 格式化函数测试
 */
import { describe, it, expect } from 'vitest'
import { fmt, fmtInt, fmtTime, pct, fmtRate, fmtCountdown } from './format'
import { D } from './decimal'

describe('fmt — number formatting', () => {
  it('zero and small numbers', () => {
    expect(fmt(0)).toBe('0')
    expect(fmt(NaN)).toBe('0')
    expect(fmt(1)).toBe('1')
    expect(fmt(5)).toBe('5')
    expect(fmt(9.5)).toBe('9.5')
    expect(fmt(99)).toBe('99')
    expect(fmt(999)).toBe('999')
  })

  it('thousands with suffix', () => {
    expect(fmt(1000)).toBe('1K')
    expect(fmt(1500)).toBe('1.5K')
    expect(fmt(1000000)).toBe('1M')
    expect(fmt(1500000)).toBe('1.5M')
    expect(fmt(1000000000)).toBe('1B')
  })

  it('negative numbers', () => {
    expect(fmt(-1)).toBe('-1')
    expect(fmt(-1000)).toBe('-1K')
  })

  it('单一路径舍入一致（v0.95：number 与 Decimal 同口径截断）', () => {
    expect(fmt(19.99)).toBe('19.9')
    expect(fmt(D(19.99))).toBe('19.9')
    expect(fmt(9.999)).toBe('9.99')
    expect(fmt(D(9.999))).toBe('9.99')
    expect(fmt(5.678)).toBe('5.67')
    expect(fmt(D(5.678))).toBe('5.67')
  })

  it('负零归一与负数朝零截断（v0.95）', () => {
    expect(fmt(-0.004)).toBe('0')
    expect(fmt(-0)).toBe('0')
    expect(fmt(-99.99)).toBe('-99.9')
    expect(fmt(-999.5)).toBe('-999')
    expect(fmt(-1000)).toBe('-1K')
  })

  it('超档科学计数法去尾零（v0.95）', () => {
    expect(fmt(D('1e66'))).toBe('1e66')
    expect(fmt(D('1.5e70'))).toBe('1.5e70')
    expect(fmt(D('-1e66'))).toBe('-1e66')
  })

  it('Decimal input', () => {
    expect(fmt(D(0))).toBe('0')
    expect(fmt(D(1000))).toBe('1K')
    expect(fmt(D(2500))).toBe('2.5K')
  })

  it('进位边界（v0.78：999,999.5 → 1M，不再输出 1000K）', () => {
    expect(fmt(D('999999.5'))).toBe('1M')
    expect(fmt(D(999999))).toBe('1M')
    expect(fmt(D('999949'))).toBe('999.9K')
    expect(fmt(D('-999999.5'))).toBe('-1M')
  })

  it('very large numbers (no Infinity)', () => {
    const big = D('1e30')
    const result = fmt(big)
    // Should produce a string with a suffix, not 'Infinity'
    expect(result).not.toBe('Infinity')
    expect(result).not.toBe('NaN')
    expect(result.length).toBeGreaterThan(0)
  })

  it('fixed parameter', () => {
    const result = fmt(0.1, 4)
    expect(result).toBe('0.1')
  })

  it('非有限兜底（v0.89：±Infinity 显示 0）', () => {
    expect(fmt(Infinity)).toBe('0')
    expect(fmt(-Infinity)).toBe('0')
    expect(fmt('Infinity')).toBe('0')
    expect(fmt(D('Infinity'))).toBe('0')
  })
})

describe('fmtInt', () => {
  it('integers', () => {
    expect(fmtInt(1000)).toBe('1,000')
    expect(fmtInt(1000000)).toBe('1,000,000')
  })
})

describe('fmtTime', () => {
  it('seconds', () => {
    expect(fmtTime(30)).toBe('30s')
    expect(fmtTime(0)).toBe('0s')
  })

  it('minutes', () => {
    expect(fmtTime(60)).toBe('1m 0s')
    expect(fmtTime(90)).toBe('1m 30s')
  })

  it('hours', () => {
    expect(fmtTime(3600)).toBe('1h 0m')
    expect(fmtTime(5400)).toBe('1h 30m')
  })

  it('days', () => {
    expect(fmtTime(86400)).toBe('1d 0h')
  })

  it('negative/invalid', () => {
    expect(fmtTime(-1)).toBe('0s')
    expect(fmtTime(Infinity)).toBe('0s')
  })
})

describe('pct', () => {
  it('basic percentages', () => {
    expect(pct(0)).toBe('0.0%')
    expect(pct(1)).toBe('100.0%')
    expect(pct(0.5)).toBe('50.0%')
  })

  it('decimal input', () => {
    expect(pct(D(0.25))).toBe('25.0%')
  })

  it('NaN/Infinity 兜底（v0.78）', () => {
    expect(pct(NaN)).toBe('0.0%')
    expect(pct(Infinity)).toBe('0.0%')
    expect(pct(D(NaN))).toBe('0.0%')
  })
})

describe('fmtRate', () => {
  it('positive rate', () => {
    expect(fmtRate(1000)).toBe('+1K /s')
  })

  it('negative rate (from Decimal)', () => {
    expect(fmtRate(D(-1000))).toBe('-1K /s')
  })

  it('negative rate (plain number)', () => {
    expect(fmtRate(-5)).toBe('-5 /s')
  })

  it('zero rate', () => {
    expect(fmtRate(0)).toBe('0 /s')
    expect(fmtRate(D(0))).toBe('0 /s')
  })
})

describe('fmtCountdown', () => {
  it('under 1 minute', () => {
    expect(fmtCountdown(0)).toBe('约<1m后')
    expect(fmtCountdown(30)).toBe('约<1m后')
    expect(fmtCountdown(59.9)).toBe('约<1m后')
  })

  it('minutes', () => {
    expect(fmtCountdown(60)).toBe('约1m后')
    expect(fmtCountdown(120)).toBe('约2m后')
    expect(fmtCountdown(1800)).toBe('约30m后')
    expect(fmtCountdown(3540)).toBe('约59m后')
  })

  it('hours', () => {
    expect(fmtCountdown(3600)).toBe('约1h后')
    expect(fmtCountdown(5400)).toBe('约1h30m后')
    expect(fmtCountdown(36000)).toBe('约10h后')
    expect(fmtCountdown(82800)).toBe('约23h后')
  })

  it('days', () => {
    expect(fmtCountdown(86400)).toBe('约1d后')
    expect(fmtCountdown(90000)).toBe('约1d1h后')
    expect(fmtCountdown(172800)).toBe('约2d后')
  })

  it('with bottleneck name', () => {
    expect(fmtCountdown(60, '晶体')).toBe('约1m后（晶体）')
    expect(fmtCountdown(3600, '合金')).toBe('约1h后（合金）')
    expect(fmtCountdown(86400, '能量')).toBe('约1d后（能量）')
  })

  it('edge cases', () => {
    expect(fmtCountdown(-1)).toBe('')
    expect(fmtCountdown(Infinity)).toBe('')
    expect(fmtCountdown(NaN)).toBe('')
  })
})
