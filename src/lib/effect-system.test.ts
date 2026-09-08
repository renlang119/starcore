/**
 * effect-system.test.ts — 效果聚合契约（v0.78）
 *
 * 固化 EffectSource 的 target 语义（见 effect-system.ts 文件头）：
 * - 带 target 类型按 target 过滤，'all'/缺省对任意 target 生效；
 * - 无 target 类型不得带 target，误带不改变结果（no-op 兜底）。
 */
import { describe, expect, it } from 'vitest'
import { EffectSystem, type EffectSource } from './effect-system'
import { D } from './decimal'

interface TestEffect {
  type: string
  target?: string
  value: number
}

/** 与各 store 同款过滤约定的测试来源 */
function makeSource(effects: TestEffect[], values: Record<string, number> = {}): EffectSource {
  return {
    getMult(type, target) {
      let m = D(1)
      for (const eff of effects) {
        if (eff.type !== type) continue
        if (target && eff.target && eff.target !== target && eff.target !== 'all') continue
        m = m.times(eff.value)
      }
      return m
    },
    getValue(type) {
      return values[type] ?? 0
    },
  }
}

describe('EffectSystem 聚合', () => {
  it('多来源乘数连乘', () => {
    const system = new EffectSystem()
    system.register(makeSource([{ type: 'production_mult', target: 'energy', value: 2 }]))
    system.register(makeSource([{ type: 'production_mult', target: 'energy', value: 3 }]))
    expect(system.getMult('production_mult', 'energy').toNumber()).toBe(6)
  })

  it('getValue 跨来源累加，无 getValue 的来源跳过', () => {
    const system = new EffectSystem()
    system.register(makeSource([], { training_slot: 1 }))
    system.register(makeSource([], { training_slot: 2 }))
    system.register({ getMult: () => D(1) })
    expect(system.getValue('training_slot')).toBe(3)
  })
})

describe('target 语义契约', () => {
  const effects: TestEffect[] = [
    { type: 'production_mult', target: 'energy', value: 2 },
    { type: 'production_mult', target: 'data', value: 3 },
    { type: 'production_mult', target: 'all', value: 1.5 },
    { type: 'production_mult', value: 1.2 },
    { type: 'explore_mult', value: 1.1 },
  ]

  it('带 target 类型：仅匹配 target 与 all/缺省生效', () => {
    const system = new EffectSystem()
    system.register(makeSource(effects))
    expect(system.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(2 * 1.5 * 1.2)
    expect(system.getMult('production_mult', 'data').toNumber()).toBeCloseTo(3 * 1.5 * 1.2)
    // 不传 target 时不过滤（调用方必须传 target，此处固化现状语义）
    expect(system.getMult('production_mult').toNumber()).toBeCloseTo(2 * 3 * 1.5 * 1.2)
  })

  it('无 target 类型：传 target 与不传结果一致（误带为 no-op）', () => {
    const system = new EffectSystem()
    system.register(makeSource(effects))
    const withoutTarget = system.getMult('explore_mult').toNumber()
    expect(withoutTarget).toBeCloseTo(1.1)
    expect(system.getMult('explore_mult', 'bogus').toNumber()).toBe(withoutTarget)
  })
})
