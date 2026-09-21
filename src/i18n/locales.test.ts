/**
 * locales.test.ts — 多语言键面守护（v1.15）
 *
 * 非默认语言包与默认语言 zh-CN：键集一致、{参数} 占位符逐键一致；
 * 英文语言包值非空且不含 CJK 与全角标点。
 */
import { describe, it, expect } from 'vitest'
import zhCN from '../locales/zh-CN/index.ts'
import en from '../locales/en/index.ts'

const zh: Record<string, string> = zhCN
const enMap: Record<string, string> = en

const PLACEHOLDER = /\{(\w+)\}/g
const CJK = /[一-鿿]/
const FULLWIDTH = /[，。；：？！「」『』（）【】、\u3000]/

describe('英文语言包键面一致性', () => {
  it('键集与默认语言完全一致', () => {
    expect(Object.keys(enMap).sort()).toEqual(Object.keys(zh).sort())
  })

  it('占位符逐键一致', () => {
    const sig = (s: string) => [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort()
    for (const k of Object.keys(zh)) {
      expect(sig(enMap[k] ?? ''), k).toEqual(sig(zh[k]))
    }
  })

  it('英文值非空且不含 CJK 与全角标点', () => {
    // 允许为空：中文量词后缀在英文中由前置词承载（Layer 5 = lead+数字+空后缀）
    const EMPTY_OK = new Set(['battle.depthUnit', 'map.depthUnit'])
    for (const [k, v] of Object.entries(enMap)) {
      if (!EMPTY_OK.has(k)) expect(v.length, k).toBeGreaterThan(0)
      expect(v, k).not.toMatch(CJK)
      expect(v, k).not.toMatch(FULLWIDTH)
    }
  })
})
