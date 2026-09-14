/*
 * useActionQueue — 首页行动队列数据组装（v0.54 从 HomeView 抽出）
 *
 * 口径：进行中全保留（天然上限 37 = 34 节点 + 3 训练槽，进度信息不丢），
 * 可执行补足至总数 ≤6（进行中 ≥6 时不显示可执行项）；
 * 训练中不再显示「N 支部队训练中」汇总卡（进度由进行中条目承担），
 * 无训练任务时显示「训练部队」引导。
 * 可探索口径：availableNodes 已排除进行中节点（v0.81 收口），待探索数不重复计数。
 */
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { BUILDINGS } from '@/data/buildings'
import { TECHS, adjustedTechCost } from '@/data/tech'
import { getNode } from '@/data/explore'
import { getUnit } from '@/data/units'

export interface ActionItem {
  id: string
  label: string
  detail: string
  path: string
  color: string
  icon: string
  status: 'in-progress' | 'actionable'
  progress?: number // 0~1，仅 in-progress 有
}

// 默认兜底（当无任何行动时，显示建造和研究两个入口）
const fallbackActions: ActionItem[] = [
  {
    id: 'fallback-build',
    label: '建造',
    detail: '升级建筑提升产能',
    path: '/build',
    color: '#00E5FF',
    icon: 'i-nav-build',
    status: 'actionable',
  },
  {
    id: 'fallback-tech',
    label: '研究',
    detail: '解锁新技术',
    path: '/tech',
    color: '#A78BFA',
    icon: 'i-nav-tech',
    status: 'actionable',
  },
]

export function useActionQueue() {
  const game = useGameStore()

  // P1-2 行动队列（合并 activeEvents + suggestions）
  const actionQueue = computed<ActionItem[]>(() => {
    const items: ActionItem[] = []
    const completedTechs = game.research.completed

    // ===== 进行中（in-progress）=====

    // 1. 探索进行中
    for (const [nodeId, prog] of Object.entries(game.exploration.progress)) {
      if (prog.startTime === 0 || prog.completed) continue
      const node = getNode(nodeId)
      if (!node) continue
      const progress = game.exploration.getProgress(nodeId)
      // 进度满格但未结算的条目转为可执行（组件与按钮设计规范 §2.2：progress >= 1 → actionable）
      const done = progress >= 1
      items.push({
        id: `explore-${nodeId}`,
        label: `探索 ${node.name}`,
        detail: done ? '已完成' : `${Math.floor(progress * 100)}%`,
        path: '/map',
        color: '#2EE6A0',
        icon: 'i-nav-explore',
        status: done ? 'actionable' : 'in-progress',
        progress,
      })
    }

    // 2. 训练进行中
    for (const task of game.military.trainingQueue) {
      const unitDef = getUnit(task.unitId)
      if (!unitDef) continue
      const progress = 1 - task.remaining / task.totalTime
      items.push({
        id: `train-${task.id}`,
        label: `训练 ${unitDef.name} ×${task.count}`,
        detail: `${Math.floor(progress * 100)}%`,
        path: '/army',
        color: '#F43F5E',
        icon: unitDef.icon,
        status: 'in-progress',
        progress,
      })
    }

    // ===== 可执行（actionable）=====

    // 3. 可升级建筑（资源已够的）
    let upgradable = 0
    for (const b of BUILDINGS) {
      if (b.requires && !completedTechs.has(b.requires)) continue
      if (game.buildings.isMaxed(b.id)) continue // 上限判定统一走 store 单一门槛
      const cost = game.buildings.getCost(b.id)
      if (game.resources.canAfford(cost)) upgradable++
    }
    if (upgradable > 0) {
      items.push({
        id: 'build-upgrade',
        label: `${upgradable} 个建筑可升级`,
        detail: '资源充足，立即升级',
        path: '/build',
        color: '#00E5FF',
        icon: 'i-nav-build',
        status: 'actionable',
      })
    }

    // 4. 可研究科技
    let researchable = 0
    for (const t of TECHS) {
      if (game.research.completed.has(t.id)) continue
      if (!game.research.available(t)) continue
      const adjustedCost = adjustedTechCost(t.cost, game.techCostMult.toNumber())
      if (game.resources.canAfford(adjustedCost)) researchable++
    }
    if (researchable > 0) {
      items.push({
        id: 'tech-research',
        label: `${researchable} 项科技可研究`,
        detail: '解锁新技术',
        path: '/tech',
        color: '#A78BFA',
        icon: 'i-nav-tech',
        status: 'actionable',
      })
    }

    // 5. 可探索节点
    const availableExplores = game.exploration.availableNodes()
    if (availableExplores.length > 0) {
      items.push({
        id: 'explore-available',
        label: `${availableExplores.length} 个星域待探索`,
        detail: '开拓新星域',
        path: '/map',
        color: '#2EE6A0',
        icon: 'i-nav-explore',
        status: 'actionable',
      })
    }

    // 6. 可训练引导（无训练任务时显示；训练进度由上方进行中条目承担，
    //    不再单独展示「N 支部队训练中」汇总卡（v0.49 起）
    if (
      game.military.trainingQueue.length === 0 &&
      (game.military.totalUnits > 0 || completedTechs.has('military_basic'))
    ) {
      items.push({
        id: 'army-train',
        label: '训练部队',
        detail: '增强军事实力',
        path: '/army',
        color: '#F43F5E',
        icon: 'i-nav-army',
        status: 'actionable',
      })
    }

    // 排序：in-progress 优先（插入序天然有序：探索 → 训练）→ actionable（建筑 > 科技 > 探索 > 军事）
    // 截断：进行中全保留；可执行补足至总数 ≤6
    const inProgress = items.filter((i) => i.status === 'in-progress')
    const actionable = items
      .filter((i) => i.status === 'actionable')
      .slice(0, Math.max(0, 6 - inProgress.length))
    return [...inProgress, ...actionable]
  })

  // 空状态
  const hasActions = computed(() => actionQueue.value.length > 0)

  const displayActions = computed(() => (hasActions.value ? actionQueue.value : fallbackActions))

  return { displayActions, hasActions }
}
