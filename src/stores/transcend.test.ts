/**
 * transcend.test.ts — 转生树 store 测试（v0.56 转生树无限化）
 *
 * 覆盖：
 * 1. 默认树结构（11 买断 + 4 无限）
 * 2. 买断节点购买封顶 level=1
 * 3. 无限节点重复购买与成本指数递增（ceil(base × growth^level)）
 * 4. 余额不足拒绝
 * 5. 效果按 level 叠加（乘数型 = value^level；target 'all' 全资源匹配）
 * 6. serialize/hydrate 往返（level 格式校验 + 防御截断）
 * 7. reset(true) 后无限节点语义保留（Infinity 不被 JSON 克隆破坏）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTranscendStore, isInfiniteNode, nextCost } from './transcend'
import { D } from '@/lib/decimal'

let store: ReturnType<typeof useTranscendStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useTranscendStore()
})

function node(id: string) {
  const n = store.tree.find((x) => x.id === id)
  if (!n) throw new Error(`node ${id} not found`)
  return n
}

describe('transcend — 默认树结构', () => {
  it('共 18 节点：14 买断 + 4 无限', () => {
    expect(store.tree).toHaveLength(18)
    expect(store.tree.filter((n) => !isInfiniteNode(n))).toHaveLength(14)
    expect(store.tree.filter((n) => isInfiniteNode(n))).toHaveLength(4)
  })

  it('自动化 QoL 节点（v0.58）：3 个买断、效果类型正确', () => {
    for (const id of ['t_auto_build', 't_auto_research', 't_auto_explore']) {
      const n = node(id)
      expect(isInfiniteNode(n)).toBe(false)
      expect(n.effects).toHaveLength(1)
      expect(n.effects[0].type).toMatch(/^auto_/)
      expect(n.effects[0].value).toBe(1)
    }
  })

  it('无限节点清单与成本参数', () => {
    const inf = store.tree.filter((n) => isInfiniteNode(n)).map((n) => n.id)
    expect(inf).toEqual(['t_inf_prod', 't_inf_combat', 't_inf_explore', 't_inf_offline'])
    expect(node('t_inf_prod').costGrowth).toBe(1.5)
    expect(node('t_inf_offline').costGrowth).toBe(1.6)
    for (const n of store.tree) expect(n.level).toBe(0)
  })
})

describe('transcend — 买断节点', () => {
  beforeEach(() => {
    store.negativeEntropy = D(100)
  })

  it('购买成功扣费并置 level=1，重复购买拒绝', () => {
    expect(store.purchaseNode('t_energy_1')).toBe(true)
    expect(node('t_energy_1').level).toBe(1)
    expect(store.negativeEntropy.toNumber()).toBe(99)
    // 买断封顶：再次购买返回 false 且不扣费
    expect(store.purchaseNode('t_energy_1')).toBe(false)
    expect(node('t_energy_1').level).toBe(1)
    expect(store.negativeEntropy.toNumber()).toBe(99)
  })

  it('余额不足拒绝购买', () => {
    store.negativeEntropy = D(0)
    expect(store.purchaseNode('t_prestige_boost')).toBe(false)
    expect(node('t_prestige_boost').level).toBe(0)
  })

  it('不存在的节点 id 返回 false', () => {
    expect(store.purchaseNode('t_nonexistent')).toBe(false)
  })
})

describe('transcend — 无限节点成本递增', () => {
  it('t_inf_prod 成本序列 5/8/12/17/26（ceil(5×1.5^n)）', () => {
    const n = node('t_inf_prod')
    expect(nextCost(n)).toBe(5)
    n.level = 1
    expect(nextCost(n)).toBe(8) // 7.5 → 8
    n.level = 2
    expect(nextCost(n)).toBe(12) // 11.25 → 12
    n.level = 3
    expect(nextCost(n)).toBe(17) // 16.875 → 17
    n.level = 4
    expect(nextCost(n)).toBe(26) // 25.3125 → 26
  })

  it('连续购买 3 级：逐级扣费、level 递增', () => {
    store.negativeEntropy = D(30)
    expect(store.purchaseNode('t_inf_prod')).toBe(true) // -5 → 25
    expect(store.purchaseNode('t_inf_prod')).toBe(true) // -8 → 17
    expect(store.purchaseNode('t_inf_prod')).toBe(true) // -12 → 5
    expect(node('t_inf_prod').level).toBe(3)
    expect(store.negativeEntropy.toNumber()).toBe(5)
    // 第 4 级需 17，余额 5 不足
    expect(store.purchaseNode('t_inf_prod')).toBe(false)
    expect(node('t_inf_prod').level).toBe(3)
  })

  it('高等级仍可购买（无实际上限；成本指数涨 → 需对应量级余额）', () => {
    // Lv49 下一级成本 = ceil(5×1.5^49) ≈ 22 亿，验证无硬上限、余额足够即可购
    store.negativeEntropy = D(1e10)
    const n = node('t_inf_prod')
    n.level = 49
    expect(nextCost(n)).toBeGreaterThan(2e9)
    expect(store.purchaseNode('t_inf_prod')).toBe(true)
    expect(n.level).toBe(50)
  })
})

describe('transcend — 效果按 level 叠加', () => {
  it('t_inf_prod Lv3 → 全产出 ×1.1^3（target all 匹配任意资源）', () => {
    store.negativeEntropy = D(100)
    store.purchaseNode('t_inf_prod')
    store.purchaseNode('t_inf_prod')
    store.purchaseNode('t_inf_prod')
    const expected = Math.pow(1.1, 3)
    for (const res of ['energy', 'crystal', 'alloy', 'data', 'dark']) {
      expect(store.getMult('production_mult', res).toNumber()).toBeCloseTo(expected, 10)
    }
  })

  it('买断+无限同类型效果连乘（t_energy_1 × t_inf_prod）', () => {
    store.negativeEntropy = D(100)
    store.purchaseNode('t_energy_1') // energy ×1.5
    store.purchaseNode('t_inf_prod') // all ×1.1
    expect(store.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(1.5 * 1.1, 10)
    // crystal 只吃到 all
    expect(store.getMult('production_mult', 'crystal').toNumber()).toBeCloseTo(1.1, 10)
  })

  it('t_inf_combat Lv2 → 攻防各 ×1.05^2', () => {
    store.negativeEntropy = D(100)
    store.purchaseNode('t_inf_combat')
    store.purchaseNode('t_inf_combat')
    const expected = Math.pow(1.05, 2)
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBeCloseTo(expected, 10)
    expect(store.getMult('combat_mult', 'defense').toNumber()).toBeCloseTo(expected, 10)
  })

  it('t_inf_explore / t_inf_offline 各走对应通道', () => {
    store.negativeEntropy = D(100)
    store.purchaseNode('t_inf_explore')
    store.purchaseNode('t_inf_offline')
    expect(store.getMult('explore_mult').toNumber()).toBeCloseTo(1.1, 10)
    // offline：t_inf_offline ×1.1（t_offline 未购）
    expect(store.getMult('offline_bonus').toNumber()).toBeCloseTo(1.1, 10)
  })

  it('getValue 通道不受无限节点影响（relic_slot/starting_energy 仅买断）', () => {
    store.negativeEntropy = D(100)
    store.purchaseNode('t_slot')
    store.purchaseNode('t_starting')
    expect(store.getValue('relic_slot')).toBe(1)
    expect(store.getValue('starting_energy')).toBe(10)
  })

  it('prestige_mult 无无限化通道（仅买断 t_prestige_boost）', () => {
    const infTypes = store.tree
      .filter((n) => isInfiniteNode(n))
      .flatMap((n) => n.effects.map((e) => e.type))
    expect(infTypes).not.toContain('prestige_mult')
    expect(infTypes).not.toContain('relic_slot')
    expect(infTypes).not.toContain('starting_energy')
  })
})

describe('transcend — serialize / hydrate', () => {
  it('往返：新格式 level 序列化后恢复一致', () => {
    store.negativeEntropy = D(42)
    store.totalTranscends = 3
    store.purchaseNode('t_energy_1')
    store.negativeEntropy = D(100)
    store.purchaseNode('t_inf_prod')
    store.purchaseNode('t_inf_prod')

    const data = store.serialize()
    expect(data.tree.find((n) => n.id === 't_inf_prod')).toEqual({ id: 't_inf_prod', level: 2 })

    // 新 store 恢复
    setActivePinia(createPinia())
    const fresh = useTranscendStore()
    fresh.hydrate(data)
    expect(fresh.tree.find((n) => n.id === 't_inf_prod')!.level).toBe(2)
    expect(fresh.tree.find((n) => n.id === 't_energy_1')!.level).toBe(1)
    expect(fresh.totalTranscends).toBe(3)
  })

  it('非法格式（purchased 旧字段）hydrate 忽略该条目，等级保持 0', () => {
    store.hydrate({
      negativeEntropy: '7',
      totalTranscends: 2,
      tree: [
        { id: 't_energy_1', purchased: true },
        { id: 't_alloy_1', level: 0 },
      ],
    } as unknown as {
      negativeEntropy: string
      totalTranscends: number
      tree: { id: string; level: number }[]
    })
    expect(node('t_energy_1').level).toBe(0) // purchased 条目无 level，忽略
    expect(node('t_alloy_1').level).toBe(0)
    expect(store.negativeEntropy.toNumber()).toBe(7)
    expect(store.totalTranscends).toBe(2)
  })

  it('防御：买断节点 level 超上限截断为 1，非法值归 0', () => {
    store.hydrate({
      negativeEntropy: '0',
      totalTranscends: 0,
      tree: [
        { id: 't_energy_1', level: 99 }, // 买断封顶 1
        { id: 't_inf_prod', level: -5 }, // 负数归 0
        { id: 't_inf_combat', level: 2.7 }, // 小数向下取整
      ],
    })
    expect(node('t_energy_1').level).toBe(1)
    expect(node('t_inf_prod').level).toBe(0)
    expect(node('t_inf_combat').level).toBe(2)
  })

  it('hydrate 忽略未知节点 id（旧档含已删除节点不崩）', () => {
    store.hydrate({
      negativeEntropy: '1',
      totalTranscends: 0,
      tree: [{ id: 't_removed_legacy', level: 1 }],
    })
    expect(store.tree.every((n) => n.id !== 't_removed_legacy')).toBe(true)
  })

  it('v0.81：totalTranscends=0 合法写入（导入替换语义可清零）', () => {
    store.totalTranscends = 5
    store.hydrate({ negativeEntropy: '0', totalTranscends: 0, tree: [] })
    expect(store.totalTranscends).toBe(0)
  })

  it('v0.81：负熵非有限值兜底钳 0，不入游戏状态', () => {
    store.negativeEntropy = D(50)
    // "1e99999999999999999" 在旧校验下曾可入档 → deser 产 Infinity
    store.hydrate({ negativeEntropy: '1e99999999999999999', totalTranscends: 0, tree: [] })
    expect(store.negativeEntropy.isFinite()).toBe(true)
    expect(store.negativeEntropy.toNumber()).toBe(0)
  })

  it('v0.81 幂聚合：Lv1000 乘数 = value^level，allEffects 不物化 level 份', () => {
    store.hydrate({
      negativeEntropy: '0',
      totalTranscends: 0,
      tree: [{ id: 't_inf_prod', level: 1000 }],
    })
    expect(node('t_inf_prod').level).toBe(1000)
    // allEffects 条目数与 level 解耦（幂聚合核心断言）
    expect(store.allEffects.length).toBe(1)
    // 相对精度比对：Math.pow 与 Decimal.pow 的绝对差在 e41 量级无意义，
    // 比对 15 位有效数字的相对误差
    const got = store.getMult('production_mult', 'energy').toNumber()
    const expected = Math.pow(1.1, 1000)
    expect(Math.abs(got / expected - 1)).toBeLessThan(1e-12)
    // 其余资源命中同一 'all' 条目，乘数一致
    for (const res of ['crystal', 'alloy', 'data', 'dark']) {
      expect(store.getMult('production_mult', res).toNumber()).toBe(got)
    }
  })

  it('v0.81 幂聚合与逐级连乘等价（Lv3 精确比对 + 加法型 = value×level）', () => {
    // 等价基准：旧语义下 t_inf_combat Lv3 = 1.05^3（attack/defense 各 1 条 effects）
    store.hydrate({
      negativeEntropy: '0',
      totalTranscends: 0,
      tree: [{ id: 't_inf_combat', level: 3 }],
    })
    const expected = Math.pow(1.05, 3)
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBeCloseTo(expected, 10)
    expect(store.allEffects.length).toBe(2) // attack + defense 各聚合为 1 条
    // 新 store 验证买断+无限混合（hydrate 不清树，跨节点断言须隔离）
    setActivePinia(createPinia())
    store = useTranscendStore()
    store.hydrate({
      negativeEntropy: '0',
      totalTranscends: 0,
      tree: [
        { id: 't_energy_1', level: 1 },
        { id: 't_inf_prod', level: 2 },
      ],
    })
    expect(store.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(1.5 * 1.1 * 1.1, 10)
    expect(store.getMult('production_mult', 'crystal').toNumber()).toBeCloseTo(1.1 * 1.1, 10)
    // 两节点、每节点一条聚合条目（repeat 携带等级，不展开）
    expect(store.allEffects.length).toBe(2)
    expect(store.allEffects.every((e) => e.repeat >= 1)).toBe(true)
  })
})

describe('transcend — reset', () => {
  it('reset(true) 清空并保留无限节点语义（Infinity 克隆不退化）', () => {
    store.negativeEntropy = D(100)
    store.purchaseNode('t_inf_prod')
    store.totalTranscends = 2
    store.reset(true)
    expect(store.negativeEntropy.toNumber()).toBe(0)
    expect(store.totalTranscends).toBe(0)
    expect(store.tree.every((n) => n.level === 0)).toBe(true)
    // 关键回归：JSON 克隆会把 Infinity 变 null——reset 后无限节点必须仍可重复购买
    store.negativeEntropy = D(30)
    expect(store.purchaseNode('t_inf_prod')).toBe(true)
    expect(store.purchaseNode('t_inf_prod')).toBe(true)
    expect(node('t_inf_prod').level).toBe(2)
  })

  it('reset()（转生）保留负熵与树', () => {
    store.negativeEntropy = D(10)
    store.purchaseNode('t_energy_1')
    store.reset(false)
    expect(store.negativeEntropy.toNumber()).toBe(9)
    expect(node('t_energy_1').level).toBe(1)
  })
})

describe('transcend — 批量购买（v0.86）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTranscendStore()
  })

  it('purchaseNodeSteps 买满语义：余额够就买满 steps 级', () => {
    store.negativeEntropy = D(1000)
    // 成本 ceil(5×1.5^L)：5/8/12/17/26/38/57/86/129/193，10 级合计 571
    const done = store.purchaseNodeSteps('t_inf_prod', 10)
    expect(done).toBe(10)
    expect(node('t_inf_prod').level).toBe(10)
    expect(store.negativeEntropy.toNumber()).toBe(1000 - 571)
  })

  it('余额中途不足：买到买不起为止，返回实际级数', () => {
    store.negativeEntropy = D(20)
    // 5 + 8 + 12 = 25 > 20 → 只买 2 级（花 13），剩 7
    const done = store.purchaseNodeSteps('t_inf_prod', 10)
    expect(done).toBe(2)
    expect(node('t_inf_prod').level).toBe(2)
    expect(store.negativeEntropy.toNumber()).toBe(7)
  })

  it('一级都买不起：返回 0 且零副作用', () => {
    store.negativeEntropy = D(3)
    const done = store.purchaseNodeSteps('t_inf_prod', 10)
    expect(done).toBe(0)
    expect(node('t_inf_prod').level).toBe(0)
    expect(store.negativeEntropy.toNumber()).toBe(3)
  })

  it('steps=1 与单次购买等价；未知节点返回 0', () => {
    store.negativeEntropy = D(50)
    expect(store.purchaseNodeSteps('t_inf_prod', 1)).toBe(1)
    expect(store.purchaseNodeSteps('ghost_node', 10)).toBe(0)
  })

  it('批量购买预览与实扣一致：负熵充足买满 steps 级', () => {
    store.negativeEntropy = D(1000)
    const preview = store.previewPurchaseSteps('t_inf_prod', 10)
    expect(preview.count).toBe(10)
    const done = store.purchaseNodeSteps('t_inf_prod', 10)
    expect(done).toBe(10)
    // 预计总花费 = 实扣额（1000 − 剩余 429）
    expect(preview.cost).toBe(571)
    expect(store.negativeEntropy.toNumber()).toBe(1000 - preview.cost)
  })

  it('批量购买预览与实扣一致：负熵中途不足买几级算几级', () => {
    store.negativeEntropy = D(20) // 5 + 8 = 13 ≤ 20，加第三级 25 > 20 → 买 2 级停
    const preview = store.previewPurchaseSteps('t_inf_prod', 10)
    expect(preview.count).toBe(2)
    expect(preview.cost).toBe(13)
  })

  it('批量购买预览：一级都买不起与未知节点返回 0', () => {
    store.negativeEntropy = D(3)
    expect(store.previewPurchaseSteps('t_inf_prod', 10)).toEqual({ count: 0, cost: 0 })
    expect(store.previewPurchaseSteps('ghost_node', 10)).toEqual({ count: 0, cost: 0 })
  })

  it('批量购买预览：买断节点按上限计 1 级，购买后归 0', () => {
    store.negativeEntropy = D(10)
    expect(store.previewPurchaseSteps('t_energy_1', 10)).toEqual({ count: 1, cost: 1 })
    store.purchaseNodeSteps('t_energy_1', 10)
    expect(store.previewPurchaseSteps('t_energy_1', 10)).toEqual({ count: 0, cost: 0 })
  })
})
