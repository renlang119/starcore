/**
 * exploration.test.ts — 探索 store 测试
 * 覆盖：初始进度 / availableNodes 前置链 / startExplore 校验与扣费 /
 * 完成时间锁定（mult 变化不影响进行中探索）/ applyTick 奖励发放 / isExploring 未知节点防御 /
 * endTime=0 容缺 / getProgress / reset / serialize-hydrate
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useExplorationStore } from './exploration'
import { EXPLORE_NODES } from '@/data/explore'
import { D } from '@/lib/decimal'

const T0 = 1_700_000_000_000 // 固定基准时间戳

let store: ReturnType<typeof useExplorationStore>
let nowSpy: ReturnType<typeof vi.spyOn>
let now: number

/** 时间推进（毫秒） */
function advance(ms: number) {
  now += ms
  nowSpy.mockReturnValue(now)
}

/** 资源扣费桩：足额恒成功并记录 */
function makeFunds() {
  const spent: Record<string, number> = {}
  const canAfford = () => true
  const spend = (cost: Partial<Record<string, number>>) => {
    for (const [k, v] of Object.entries(cost)) spent[k] = (spent[k] ?? 0) + (v as number)
    return true
  }
  return { spent, canAfford, spend }
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useExplorationStore()
  now = T0
  nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
})

afterEach(() => {
  nowSpy.mockRestore()
})

describe('exploration — 初始状态', () => {
  it('34 节点全部未开始未完成', () => {
    expect(EXPLORE_NODES).toHaveLength(34)
    for (const n of EXPLORE_NODES) {
      expect(store.isCompleted(n.id)).toBe(false)
      expect(store.isExploring(n.id)).toBe(false)
      expect(store.getProgress(n.id)).toBe(0)
    }
    expect(store.count).toBe(0)
  })

  it('availableNodes 初始仅 node_orbit（无前置）', () => {
    expect(store.availableNodes().map((n) => n.id)).toEqual(['node_orbit'])
  })
})

describe('exploration — startExplore 校验', () => {
  it('前置未完成拒绝（node_inner 需 node_orbit）', () => {
    const f = makeFunds()
    expect(store.startExplore('node_inner', D(1), f.canAfford, f.spend)).toBe(false)
    expect(Object.keys(f.spent)).toHaveLength(0) // 未扣费
  })

  it('资源不足拒绝且零副作用', () => {
    expect(
      store.startExplore(
        'node_orbit',
        D(1),
        () => false,
        () => true
      )
    ).toBe(false)
    expect(store.isExploring('node_orbit')).toBe(false)
  })

  it('canAfford 通过但 spend 失败同样拒绝（原子性）', () => {
    expect(
      store.startExplore(
        'node_orbit',
        D(1),
        () => true,
        () => false
      )
    ).toBe(false)
    expect(store.isExploring('node_orbit')).toBe(false)
  })

  it('未知节点 id 拒绝', () => {
    const f = makeFunds()
    expect(store.startExplore('node_ghost', D(1), f.canAfford, f.spend)).toBe(false)
  })

  it('进行中重复开始拒绝', () => {
    const f = makeFunds()
    expect(store.startExplore('node_orbit', D(1), f.canAfford, f.spend)).toBe(true)
    expect(store.startExplore('node_orbit', D(1), f.canAfford, f.spend)).toBe(false)
    expect(f.spent.energy).toBe(100) // 只扣一次
  })

  it('成功路径：扣费一次、进入进行中、endTime = now + time/mult×1000', () => {
    const f = makeFunds()
    expect(store.startExplore('node_inner', D(2), f.canAfford, f.spend)).toBe(false) // 前置未过
    // 先完成 orbit
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    const results = store.applyTick()
    expect(results).toHaveLength(1)
    // 再开始 inner：time=120s, mult=2 → 60s 后完成
    expect(store.startExplore('node_inner', D(2), f.canAfford, f.spend)).toBe(true)
    const p = store.progress['node_inner']
    expect(p.endTime - p.startTime).toBe(60_000)
    expect(f.spent.energy).toBe(100 + 1000) // orbit 100 + inner 1000
    expect(f.spent.data).toBe(50)
  })
})

describe('exploration — 完成时间锁定', () => {
  it('完成时间在发起时锁定（mult 只作用于发起时刻，不回溯进行中条目）', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend) // 30s @1x
    expect(store.progress['node_orbit'].endTime - store.progress['node_orbit'].startTime).toBe(
      30_000
    )
    advance(20_000)
    expect(store.applyTick()).toHaveLength(0) // 恰 30s 才完成，不提前
    advance(10_000)
    expect(store.applyTick().map((r) => r.nodeId)).toEqual(['node_orbit'])
    // 2x mult 发起 inner：60s 完成而非 120s，证明 mult 只在发起时生效
    store.startExplore('node_inner', D(2), f.canAfford, f.spend)
    expect(store.progress['node_inner'].endTime - store.progress['node_inner'].startTime).toBe(
      60_000
    )
    advance(60_000)
    expect(store.applyTick().map((r) => r.nodeId)).toEqual(['node_inner'])
  })

  it('完成时返回奖励', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    const [r] = store.applyTick()
    expect(r.rewards).toEqual({ energy: 300, crystal: 10, alloy: 20 })
    expect(store.isCompleted('node_orbit')).toBe(true)
  })

  it('已完成节点不重复发放（applyTick 幂等）', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    expect(store.applyTick()).toHaveLength(1)
    expect(store.applyTick()).toHaveLength(0)
    advance(60_000)
    expect(store.applyTick()).toHaveLength(0)
  })

  it('支线串行解锁：前序完成后方可探索下一节点', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    store.applyTick() // orbit 完成，解锁 inner
    // outer 需先完成 inner，按依赖链逐节点推进：
    store.startExplore('node_inner', D(1), f.canAfford, f.spend)
    advance(120_000)
    store.applyTick() // inner 完成，解锁 outer
    store.startExplore('node_outer', D(1), f.canAfford, f.spend)
    advance(300_000)
    store.applyTick() // outer 600s，推进不足未完成
    expect(store.isCompleted('node_outer')).toBe(false)
    advance(300_000)
    const results = store.applyTick()
    expect(results.map((r) => r.nodeId)).toEqual(['node_outer'])
  })
})

describe('exploration — 损坏数据容缺（endTime=0 直接完成结算）', () => {
  it('endTime=0 的进行中条目视为已完成：applyTick 结算一次后归于一致', () => {
    store.hydrate({
      progress: {
        node_orbit: { nodeId: 'node_orbit', startTime: T0 - 10_000, endTime: 0, completed: false },
      },
    })
    // 兼容代码已移除：不再按 mult 补算，now >= 0 直接完成（防死锁的容缺路径）
    expect(store.applyTick()).toHaveLength(1)
    expect(store.progress['node_orbit'].completed).toBe(true)
    // 幂等：已完成不重复结算
    expect(store.applyTick()).toHaveLength(0)
  })
})

describe('exploration — getProgress', () => {
  it('0 → 0.5 → 1 三点采样', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend) // 30s
    expect(store.getProgress('node_orbit')).toBe(0)
    advance(15_000)
    expect(store.getProgress('node_orbit')).toBeCloseTo(0.5)
    advance(20_000) // 超时钳制为 1
    expect(store.getProgress('node_orbit')).toBe(1)
  })

  it('已完成恒为 1；未开始恒为 0', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    store.applyTick()
    expect(store.getProgress('node_orbit')).toBe(1)
    expect(store.getProgress('node_deep')).toBe(0)
  })
})

describe('exploration — reset / serialize / hydrate', () => {
  it('reset 清空全部进度（含已完成）', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    store.applyTick()
    store.reset()
    expect(store.count).toBe(0)
    expect(store.availableNodes().map((n) => n.id)).toEqual(['node_orbit'])
  })

  it('serialize/hydrate 往返：已完成与进行中状态保留', () => {
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    advance(30_000)
    store.applyTick()
    store.startExplore('node_inner', D(1), f.canAfford, f.spend)
    const data = store.serialize()

    setActivePinia(createPinia())
    nowSpy.mockReturnValue(now)
    const s2 = useExplorationStore()
    s2.hydrate(data)
    expect(s2.isCompleted('node_orbit')).toBe(true)
    expect(s2.isExploring('node_inner')).toBe(true)
    expect(s2.count).toBe(1)
  })

  it('hydrate 忽略未知节点残留键（按 EXPLORE_NODES 白名单）', () => {
    store.hydrate({
      progress: {
        node_ghost: { nodeId: 'node_ghost', startTime: 1, endTime: 2, completed: true },
        node_orbit: { nodeId: 'node_orbit', startTime: 0, endTime: 0, completed: true },
      },
    })
    expect(store.progress['node_ghost']).toBeUndefined()
    expect(store.isCompleted('node_orbit')).toBe(true)
  })

  // —— v0.75：isExploring 未知节点返回 false（原 undefined !== 0 误判为 true）——
  it('isExploring 未知节点/空 id 返回 false', () => {
    expect(store.isExploring('node_ghost')).toBe(false)
    expect(store.isExploring('')).toBe(false)
    // 未开始/已完成仍为 false，进行中为 true（回归）
    expect(store.isExploring('node_orbit')).toBe(false)
    const f = makeFunds()
    store.startExplore('node_orbit', D(1), f.canAfford, f.spend)
    expect(store.isExploring('node_orbit')).toBe(true)
  })
})
