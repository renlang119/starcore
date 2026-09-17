/**
 * decimal.ts — 大数运算辅助
 * 统一用 decimal.js 处理所有游戏数值，避免浮点精度问题
 *
 * 使用 Decimal.clone() 创建独立配置的构造器，
 * 避免修改全局 decimal.js 配置（防止与第三方库冲突）。
 */
import _Decimal from 'decimal.js'

const Decimal = _Decimal.clone()
Decimal.set({ precision: 30, rounding: Decimal.ROUND_DOWN, toExpNeg: -30, toExpPos: 60 })

export { Decimal }
export type Decimal = _Decimal
export namespace Decimal {
  export type Value = _Decimal.Value
  export type Rounding = _Decimal.Rounding
  export type Modulo = _Decimal.Modulo
}

/** D 是 Decimal 的简写别名，调用处更紧凑 */
export const D = (v: _Decimal.Value | number | string): _Decimal => new Decimal(v ?? 0)

export const add = (a: _Decimal.Value, b: _Decimal.Value): _Decimal => D(a).plus(b)
export const gte = (a: _Decimal.Value, b: _Decimal.Value): boolean => D(a).gte(b)

/** 序列化 Decimal → string（安全保留精度，可反序列化） */
export const ser = (v: _Decimal.Value): string => D(v).toString()
/** 反序列化 string → Decimal */
export const deser = (s: string | undefined | null): _Decimal => D(s ?? 0)
