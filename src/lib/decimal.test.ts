/**
 * decimal.test.ts — decimal.ts 序列化与基础运算测试
 */
import { describe, it, expect } from 'vitest'
import { D, ser, deser, add, sub, mul, div, gte, gt, lte, lt, eq, min, max } from './decimal'

describe('decimal serialization', () => {
  it('ser 输出精确形态（存档落盘依赖此形态）', () => {
    // 精确形态组：输入即输出
    const exact: Array<[string, string]> = [
      ['0', '0'],
      ['1', '1'],
      ['1.5', '1.5'],
      ['100', '100'],
      ['1e10', '10000000000'],
      ['0.000001', '0.000001'],
    ]
    for (const [input, expected] of exact) {
      expect(ser(D(input))).toBe(expected)
    }
    // 归一化组：科学计数法输入归一为普通数字形态（存档落盘口径）
    expect(ser(D('1e30'))).toBe('1000000000000000000000000000000')
    expect(ser(D('999999999999999999999'))).toBe('999999999999999999999')
  })

  it('deser/ser round-trip preserves value', () => {
    const cases = ['0', '1', '1.5', '100', '1e10', '1e30', '999999999999999999999', '0.000001']
    for (const s of cases) {
      expect(deser(ser(D(s))).eq(D(s))).toBe(true)
    }
  })

  it('deser handles null/undefined as 0', () => {
    expect(deser(undefined).eq(D(0))).toBe(true)
    expect(deser(null).eq(D(0))).toBe(true)
  })

  it('D handles null/undefined as 0', () => {
    expect(D(null as any).eq(D(0))).toBe(true)
    expect(D(undefined as any).eq(D(0))).toBe(true)
  })
})

describe('decimal arithmetic', () => {
  it('add', () => {
    expect(add(2, 3).toNumber()).toBe(5)
    expect(add('1e20', '1e20').toNumber()).toBe(2e20)
  })

  it('sub', () => {
    expect(sub(10, 3).toNumber()).toBe(7)
  })

  it('mul', () => {
    expect(mul(6, 7).toNumber()).toBe(42)
    expect(mul('1e10', '1e10').toNumber()).toBe(1e20)
  })

  it('div', () => {
    expect(div(10, 4).toNumber()).toBe(2.5)
  })
})

describe('decimal comparisons', () => {
  it('eq', () => {
    expect(eq(5, 5)).toBe(true)
    expect(eq(5, 6)).toBe(false)
  })

  it('gt / gte', () => {
    expect(gt(5, 3)).toBe(true)
    expect(gt(3, 5)).toBe(false)
    expect(gt(5, 5)).toBe(false)
    expect(gte(5, 5)).toBe(true)
  })

  it('lt / lte', () => {
    expect(lt(3, 5)).toBe(true)
    expect(lt(5, 3)).toBe(false)
    expect(lte(5, 5)).toBe(true)
  })

  it('min / max', () => {
    expect(min(3, 5).toNumber()).toBe(3)
    expect(max(3, 5).toNumber()).toBe(5)
  })
})

describe('decimal precision (clone independence)', () => {
  it('large number precision preserved', () => {
    // precision: 30 means 30 significant digits
    // 1e20 + 1 should preserve the +1 since 1e20 has only 21 digits
    const big = D('1e20')
    expect(big.plus(1).minus(big).toNumber()).toBe(1)
  })

  it('ROUND_DOWN behavior', () => {
    // With ROUND_DOWN, 0.1 + 0.2 should not round up
    const result = add(0.1, 0.2)
    // decimal.js with ROUND_DOWN should give 0.3 (not 0.30000000000000004)
    expect(result.toNumber()).toBeLessThanOrEqual(0.3)
  })
})
