/**
 * useActionQueue.test.ts — 首页行动队列规则（v0.49 口径，v0.54 迁移至 composable 层）
 *
 * 口径：进行中全保留（天然上限 25 = 22 节点 + 3 训练槽），可执行补足至总数 ≤6；
 * 训练中不再显示「N 支部队训练中」汇总卡（进度由进行中条目承担），
 * 无训练任务时显示「训练部队」引导。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActionQueue } from './useActionQueue'
import { useGameStore } from '@/stores/game'
import type { UnitId } from '@/data/units'

function freshGame() {
  setActivePinia(createPinia())
  return useGameStore()
}

/** 注资源到「什么都能买得起」 */
function richAll(game: ReturnType<typeof freshGame>) {
  for (const r of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
    game.resources.setAmount(r, 1e12)
  }
}

let trainSeq = 0
function trainTask(unitId: UnitId, totalTime = 100) {
  return { id: `t${++trainSeq}`, unitId, count: 1, remaining: totalTime / 2, totalTime }
}

function exploring(game: ReturnType<typeof freshGame>, nodeId: string) {
  const now = Date.now()
  game.exploration.progress[nodeId] = {
    nodeId,
    startTime: now - 1000,
    endTime: now + 3600e3,
    completed: false,
  }
}

const texts = (items: ReturnType<typeof useActionQueue>['displayActions']['value']) =>
  items.map((i) => i.label + i.detail).join()

describe('useActionQueue 行动队列', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('无任何行动时显示兜底入口（建造/研究）', () => {
    const game = freshGame()
    // 资源清零（建筑/科技买不起）+ 探索节点全完成（availableNodes 不看资源，
    // 只看完结状态）→ 队列真空，触发兜底
    for (const r of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
      game.resources.setAmount(r, 0)
    }
    const now = Date.now()
    for (const n of [
      'node_orbit',
      'node_inner',
      'node_outer',
      'node_deep',
      'node_stellar_gate',
      'node_stellar_mine',
      'node_stellar_forge',
      'node_stellar_dead',
      'node_stellar_core',
      'node_stellar_edge',
      'node_cluster_gate',
      'node_cluster_swarm',
      'node_cluster_ruin',
      'node_cluster_heart',
      'node_cluster_hollow',
      'node_cluster_silence',
      'node_arm_gate',
      'node_arm_cradle',
      'node_arm_grave',
      'node_arm_spine',
      'node_arm_abyss',
      'node_arm_threshold',
    ]) {
      game.exploration.progress[n] = {
        nodeId: n,
        startTime: now - 1000,
        endTime: now,
        completed: true,
      }
    }
    const { displayActions, hasActions } = useActionQueue()
    expect(hasActions.value).toBe(false)
    expect(displayActions.value.length).toBe(2)
    const t = texts(displayActions.value)
    expect(t).toContain('升级建筑提升产能')
    expect(t).toContain('解锁新技术')
  })

  it('训练中：无汇总卡、无训练引导，进度逐条展示', () => {
    const game = freshGame()
    game.research.complete('military_basic')
    game.military.hydrate({
      owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
      training: [trainTask('assault'), trainTask('guard')],
      formations: [],
    })
    const { displayActions } = useActionQueue()
    const t = texts(displayActions.value)
    expect(t).not.toContain('支部队训练中')
    expect(t).not.toContain('增强军事实力')
    expect(t).toContain('训练 突击兵')
    expect(t).toContain('训练 护卫兵')
  })

  it('无训练且已解锁军事：显示「训练部队」引导', () => {
    const game = freshGame()
    game.research.complete('military_basic')
    const { displayActions } = useActionQueue()
    expect(texts(displayActions.value)).toContain('训练部队')
  })

  it('截断：进行中全保留，可执行补足至总数 ≤6', () => {
    const game = freshGame()
    richAll(game)
    game.research.complete('military_basic')
    game.research.complete('explore_basic')
    game.military.hydrate({
      owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
      training: [trainTask('assault'), trainTask('guard'), trainTask('heavy')],
      formations: [],
    })
    exploring(game, 'node_orbit')
    exploring(game, 'node_inner')
    const { displayActions } = useActionQueue()
    // 5 进行中（2 探索 + 3 训练）+ 1 可执行 = 6
    expect(displayActions.value.length).toBe(6)
    expect(displayActions.value.filter((i) => i.status === 'in-progress').length).toBe(5)
  })

  it('进行中 ≥6 时不显示可执行项（总数 = 进行中条数）', () => {
    const game = freshGame()
    richAll(game)
    game.research.complete('military_basic')
    game.research.complete('explore_basic')
    game.military.hydrate({
      owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
      training: [trainTask('assault'), trainTask('guard'), trainTask('heavy')],
      formations: [],
    })
    for (const n of ['node_orbit', 'node_inner', 'node_outer', 'node_deep']) exploring(game, n)
    const { displayActions } = useActionQueue()
    // 7 进行中，0 可执行
    expect(displayActions.value.length).toBe(7)
    expect(displayActions.value.filter((i) => i.status === 'actionable').length).toBe(0)
  })
})
