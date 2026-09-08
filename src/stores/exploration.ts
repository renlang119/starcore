/**
 * exploration.ts — 探索系统 store
 * 星图节点探索、进度跟踪
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { EXPLORE_NODES, getNode, type ExploreNode } from '@/data/explore'
import type { Decimal } from '@/lib/decimal'
import type { ExplorationSaveData } from '@/lib/storage'

export interface ExploreProgress {
  nodeId: string
  startTime: number // 0 = 未开始
  endTime: number // 预计完成时间戳（0 = 未开始）；锁定后不受 exploreMult 变化影响
  completed: boolean
}

export const useExplorationStore = defineStore('exploration', () => {
  const progress = ref<Record<string, ExploreProgress>>({})
  for (const n of EXPLORE_NODES)
    progress.value[n.id] = { nodeId: n.id, startTime: 0, endTime: 0, completed: false }

  const completedNodes = computed(
    () =>
      new Set(
        Object.values(progress.value)
          .filter((p) => p.completed)
          .map((p) => p.nodeId)
      )
  )
  const count = computed(() => completedNodes.value.size)

  function isCompleted(id: string) {
    return progress.value[id]?.completed ?? false
  }
  function isExploring(id: string) {
    return progress.value[id]?.startTime !== 0 && !progress.value[id]?.completed
  }

  /** 可探索的节点 */
  function availableNodes(): ExploreNode[] {
    return EXPLORE_NODES.filter((n) => {
      if (isCompleted(n.id)) return false
      if (!n.requires) return true
      return n.requires.every((r) => isCompleted(r))
    })
  }

  /** 开始探索 */
  function startExplore(
    nodeId: string,
    exploreMult: Decimal,
    canAffordFn: (cost: Partial<Record<string, number>>) => boolean,
    spendFn: (cost: Partial<Record<string, number>>) => boolean
  ): boolean {
    const node = getNode(nodeId)
    if (!node) return false
    if (isCompleted(nodeId) || isExploring(nodeId)) return false
    if (node.requires && !node.requires.every((r) => isCompleted(r))) return false
    if (!canAffordFn(node.cost)) return false
    if (!spendFn(node.cost)) return false
    // 锁定完成时间：基于当前 exploreMult 计算，之后 mult 变化不影响本次探索
    const required = node.time / exploreMult.toNumber()
    const now = Date.now()
    progress.value[nodeId] = {
      nodeId,
      startTime: now,
      endTime: now + required * 1000,
      completed: false,
    }
    return true
  }

  /** tick：检查探索是否完成（基于锁定 endTime） */
  function applyTick(): {
    nodeId: string
    rewards: Partial<Record<string, number>>
    story?: string
    unlocks: string[]
  }[] {
    const now = Date.now()
    const results: {
      nodeId: string
      rewards: Partial<Record<string, number>>
      story?: string
      unlocks: string[]
    }[] = []
    for (const p of Object.values(progress.value)) {
      if (p.completed || p.startTime === 0) continue
      if (now >= p.endTime) {
        p.completed = true
        const node = getNode(p.nodeId)
        if (!node) continue
        results.push({
          nodeId: p.nodeId,
          rewards: { ...node.rewards },
          story: node.story,
          unlocks: node.unlocksStronghold ?? [],
        })
      }
    }
    return results
  }

  /** 探索进度百分比（基于锁定 endTime，与 tick 同步） */
  function getProgress(nodeId: string): number {
    const p = progress.value[nodeId]
    if (!p || p.startTime === 0) return 0
    if (p.completed) return 1
    const now = Date.now()
    if (now >= p.endTime) return 1
    return Math.min(1, (now - p.startTime) / (p.endTime - p.startTime))
  }

  function reset() {
    progress.value = {}
    for (const n of EXPLORE_NODES)
      progress.value[n.id] = { nodeId: n.id, startTime: 0, endTime: 0, completed: false }
  }

  function serialize() {
    return { progress: { ...progress.value } }
  }
  function hydrate(data: ExplorationSaveData | undefined) {
    if (!data?.progress) return
    for (const n of EXPLORE_NODES) {
      if (data.progress[n.id]) progress.value[n.id] = { ...data.progress[n.id] }
    }
  }

  return {
    progress,
    completedNodes,
    count,
    isCompleted,
    isExploring,
    availableNodes,
    startExplore,
    applyTick,
    getProgress,
    reset,
    serialize,
    hydrate,
  }
})
