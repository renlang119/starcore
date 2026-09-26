/**
 * traits.test.ts — 编队特性数据层单测（v1.23 可玩内容扩展方案 7）
 *
 * 覆盖：白名单与默认值、getTrait 回退（未知 id / 缺省 / 非法形态）、
 * 内容键闭合（名称与描述不含回落键名）、数值定稿契约（校准结论冻结值）。
 */
import { describe, it, expect } from 'vitest'
import { TRAITS, getTrait, DEFAULT_TRAIT_ID } from '@/data/traits'
import { t } from '@/i18n'

const CJK = /[一-鿿]/

describe('编队特性数据层', () => {
  it('白名单 5 项含默认均衡', () => {
    expect(TRAITS).toHaveLength(5)
    expect(TRAITS.map((tr) => tr.id)).toContain('balanced')
    expect(DEFAULT_TRAIT_ID).toBe('balanced')
  })

  it('数值定稿契约（校准冻结值）', () => {
    const byId = Object.fromEntries(TRAITS.map((tr) => [tr.id, tr]))
    expect(byId['balanced'].atkMult).toBe(1)
    expect(byId['assault_doctrine'].atkMult).toBe(1.12)
    expect(byId['bastion_doctrine'].hpMult).toBe(1.15)
    expect(byId['counter_doctrine'].counterBonus).toBe(0.25)
    expect(byId['logistics_doctrine'].garrisonMult).toBe(1.2)
    // 单一效果原则：每个实效特性只有一个非 1/非 0 乘区
    for (const tr of TRAITS) {
      if (tr.id === 'balanced') continue
      const active = [
        tr.atkMult !== 1,
        tr.hpMult !== 1,
        tr.counterBonus !== 0,
        tr.garrisonMult !== 1,
      ]
      expect(active.filter(Boolean).length).toBe(1)
    }
  })

  it('getTrait 回退：未知 id / 空值 / 缺省均回落均衡', () => {
    expect(getTrait('unknown_trait').id).toBe('balanced')
    expect(getTrait('').id).toBe('balanced')
    expect(getTrait(undefined).id).toBe('balanced')
    expect(getTrait(null).id).toBe('balanced')
    expect(getTrait('assault_doctrine').id).toBe('assault_doctrine')
  })

  it('内容键闭合：名称与描述可解析且不含回落键名', () => {
    for (const tr of TRAITS) {
      expect(tr.name).not.toBe(`content.traits.${tr.id}.name`)
      expect(tr.name).toMatch(CJK)
      expect(tr.desc).not.toBe(`content.traits.${tr.id}.desc`)
      expect(tr.desc).toMatch(CJK)
      expect(t(`content.traits.${tr.id}.name`)).toBe(tr.name)
    }
  })
})
