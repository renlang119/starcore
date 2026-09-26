/**
 * resources.test.ts — 资源 store 测试
 * 覆盖：初始状态 / gain / spend / canAfford / spendCost 原子性 /
 * applyTick / reset（含 keepDark）/ serialize-hydrate
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useResourcesStore } from './resources'
import { D } from '@/lib/decimal'

describe('resources — 初始状态', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('新档：能量 50，其余资源与全部 totals/production 为 0', () => {
    const r = useResourcesStore()
    expect(r.getAmount('energy').toNumber()).toBe(50)
    for (const t of ['crystal', 'alloy', 'data', 'dark'] as const) {
      expect(r.getAmount(t).toNumber()).toBe(0)
    }
    for (const t of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
      expect(r.getTotal(t).toNumber()).toBe(0)
      expect(r.getRate(t).toNumber()).toBe(0)
    }
  })

  it('getMeta 返回五种资源的元信息', () => {
    const r = useResourcesStore()
    expect(r.getMeta('energy').name).toBe('能量')
    expect(Object.keys(r.allMeta)).toHaveLength(5)
  })
})

describe('resources — gain / spend', () => {
  let r: ReturnType<typeof useResourcesStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    r = useResourcesStore()
  })

  it('gain 同时增加余额与历史总产出', () => {
    r.gain('crystal', 100)
    expect(r.getAmount('crystal').toNumber()).toBe(100)
    expect(r.getTotal('crystal').toNumber()).toBe(100)
    r.gain('crystal', 50)
    expect(r.getAmount('crystal').toNumber()).toBe(150)
    expect(r.getTotal('crystal').toNumber()).toBe(150)
  })

  it('gain 支持 Decimal 入参（大数精度不丢）', () => {
    r.gain('crystal', D('1e20'))
    r.gain('crystal', D('1e20'))
    expect(r.getAmount('crystal').eq(D('2e20'))).toBe(true) // 晶体初始 0，无干扰
  })

  it('spend 足额成功扣余额、不动 totals', () => {
    r.gain('alloy', 100)
    expect(r.spend('alloy', 40)).toBe(true)
    expect(r.getAmount('alloy').toNumber()).toBe(60)
    expect(r.getTotal('alloy').toNumber()).toBe(100)
  })

  it('spend 不足额拒绝且余额不变', () => {
    r.gain('alloy', 10)
    expect(r.spend('alloy', 40)).toBe(false)
    expect(r.getAmount('alloy').toNumber()).toBe(10)
  })

  it('setAmount 直接覆写余额（不影响 totals）', () => {
    r.setAmount('energy', 999)
    expect(r.getAmount('energy').toNumber()).toBe(999)
    expect(r.getTotal('energy').toNumber()).toBe(0)
  })
})

describe('resources — canAfford / spendCost', () => {
  let r: ReturnType<typeof useResourcesStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    r = useResourcesStore()
  })

  it('canAfford：多资源逐项判定，任一不足即 false', () => {
    r.gain('crystal', 10)
    expect(r.canAfford({ energy: 50, crystal: 10 })).toBe(true) // 能量=新档初始 50
    expect(r.canAfford({ energy: 50, crystal: 11 })).toBe(false)
    expect(r.canAfford({ energy: 51, crystal: 10 })).toBe(false)
  })

  it('canAfford：等额边界判定为可负担（gte 语义）', () => {
    expect(r.canAfford({ energy: 50 })).toBe(true)
    expect(r.canAfford({ energy: 50.0001 })).toBe(false)
  })

  it('canAfford：未知资源键不拦截（白名单遍历语义）', () => {
    expect(r.canAfford({ energy: 10, mana: 999 } as never)).toBe(true)
  })

  it('spendCost 原子性：任一资源不足则整组不扣', () => {
    r.gain('crystal', 0)
    expect(r.spendCost({ energy: 50, crystal: 10 })).toBe(false)
    expect(r.getAmount('energy').toNumber()).toBe(50) // 未被扣走（仍为初始值）
  })

  it('spendCost 足额：整组一次扣除', () => {
    r.gain('crystal', 100)
    expect(r.spendCost({ energy: 50, crystal: 100 })).toBe(true)
    expect(r.getAmount('energy').toNumber()).toBe(0)
    expect(r.getAmount('crystal').toNumber()).toBe(0)
  })
})

describe('resources — production / applyTick', () => {
  let r: ReturnType<typeof useResourcesStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    r = useResourcesStore()
  })

  it('setProduction 写入速率，getRate 读回', () => {
    r.setProduction('energy', D(2.5))
    expect(r.getRate('energy').toNumber()).toBe(2.5)
  })

  it('applyTick：amount 与 totals 各增 production × dt', () => {
    r.setProduction('energy', D(3))
    r.setProduction('data', D(0.5))
    r.applyTick(10)
    expect(r.getAmount('energy').toNumber()).toBe(80) // 50 + 3×10
    expect(r.getTotal('energy').toNumber()).toBe(30)
    expect(r.getAmount('data').toNumber()).toBe(5)
  })

  it('applyTick：零产出资源跳过（余额与 totals 均不动）', () => {
    r.applyTick(60)
    expect(r.getAmount('crystal').toNumber()).toBe(0)
    expect(r.getTotal('crystal').toNumber()).toBe(0)
  })

  it('applyTick：小数 dt 精度（decimal 通道无浮点漂移）', () => {
    r.setProduction('energy', D('0.1'))
    for (let i = 0; i < 10; i++) r.applyTick(0.1)
    expect(r.getTotal('energy').toString()).toBe('0.1') // 0.1/s × 0.1s × 10 次，精确无漂移
  })
})

describe('resources — reset', () => {
  let r: ReturnType<typeof useResourcesStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    r = useResourcesStore()
  })

  it('reset()：余额回到初始（能量 50），totals/production 全清', () => {
    r.gain('energy', 1000)
    r.gain('dark', 50)
    r.setProduction('energy', D(5))
    r.reset()
    expect(r.getAmount('energy').toNumber()).toBe(50)
    expect(r.getAmount('dark').toNumber()).toBe(0)
    expect(r.getTotal('energy').toNumber()).toBe(0)
    expect(r.getRate('energy').toNumber()).toBe(0)
  })

  it('reset(true)：暗物质余额保留，totals 仍清零（转生语义）', () => {
    r.gain('dark', 50)
    r.gain('energy', 1000)
    r.reset(true)
    expect(r.getAmount('dark').toNumber()).toBe(50)
    expect(r.getTotal('dark').toNumber()).toBe(0)
    expect(r.getAmount('energy').toNumber()).toBe(50)
  })
})

describe('resources — serialize / hydrate', () => {
  it('往返一致：amounts 与 totals 以字符串序列化后恢复', () => {
    setActivePinia(createPinia())
    const r = useResourcesStore()
    r.gain('crystal', D('1e25'))
    r.gain('alloy', 123.456)
    const data = r.serialize()
    expect(typeof data.amounts.crystal).toBe('string')

    setActivePinia(createPinia())
    const r2 = useResourcesStore()
    r2.hydrate(data)
    expect(r2.getAmount('crystal').eq(D('1e25'))).toBe(true)
    expect(r2.getTotal('crystal').eq(D('1e25'))).toBe(true)
    expect(r2.getAmount('alloy').toNumber()).toBeCloseTo(123.456)
  })

  it('hydrate 部分字段缺失：缺失键保持默认', () => {
    setActivePinia(createPinia())
    const r = useResourcesStore()
    r.hydrate({ amounts: { crystal: '7' } } as never)
    expect(r.getAmount('crystal').toNumber()).toBe(7)
    expect(r.getAmount('energy').toNumber()).toBe(50) // 默认未被冲掉
  })
})
