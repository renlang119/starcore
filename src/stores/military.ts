/**
 * military.ts — 造兵与部队系统 store
 * 4 种兵种训练 + 部队编组（最多 3 支编队）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Decimal } from '@/lib/decimal'
import { getUnit, type UnitId, type UnitDef } from '@/data/units'
import type { MilitarySaveData } from '@/lib/storage'

export interface Formation {
  id: string
  name: string
  units: Record<UnitId, number> // 兵种 → 数量
}

export interface TrainingTask {
  id: string
  unitId: UnitId
  count: number
  remaining: number // 剩余秒
  totalTime: number
}

/** 训练并行槽：基础 1 槽，上限 3 槽（科技「集群操练 I/II」各 +1） */
export const BASE_TRAINING_SLOTS = 1
export const MAX_TRAINING_SLOTS = 3

// 并行槽上限由 game store 注入（依赖效果系统聚合科技加成），
// 避免 military store 直接引用 research/effectSystem（同 setRelicSlotProvider 模式）
let trainingSlotProvider: () => number = () => BASE_TRAINING_SLOTS
export function setTrainingSlotProvider(fn: () => number) {
  trainingSlotProvider = fn
}

export const useMilitaryStore = defineStore('military', () => {
  // —— state ——
  const owned = ref<Record<UnitId, number>>({
    assault: 0,
    guard: 0,
    heavy: 0,
    psionic: 0,
  })
  const trainingQueue = ref<TrainingTask[]>([])
  const formations = ref<Formation[]>([
    { id: 'f1', name: '先锋编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
    { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
    { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
  ])

  let taskId = 0

  // —— getters ——
  const getOwned = (id: UnitId) => owned.value[id]
  const totalUnits = computed(() => Object.values(owned.value).reduce((a, b) => a + b, 0))
  /** 训练并行槽上限（1~3） */
  const maxTrainingSlots = computed(() =>
    Math.min(MAX_TRAINING_SLOTS, Math.max(BASE_TRAINING_SLOTS, trainingSlotProvider()))
  )
  const isUnlocked = (def: UnitDef, completedTechs: Set<string>) =>
    !def.requires || completedTechs.has(def.requires)

  /** 编队总战力（用于 UI 展示） */
  function formationPower(
    formation: Formation,
    atkMult: Decimal,
    defMult: Decimal
  ): { atk: number; def: number; hp: number } {
    let atk = 0,
      def = 0,
      hp = 0
    for (const [uid, count] of Object.entries(formation.units)) {
      if (count <= 0) continue
      const u = getUnit(uid as UnitId)
      if (!u) continue
      atk += u.attack * atkMult.toNumber() * count
      def += u.defense * defMult.toNumber() * count
      hp += u.hp * count
    }
    return { atk: Math.round(atk), def: Math.round(def), hp }
  }

  /** 全军战力（所有已造兵种） */
  function totalPower(atkMult: Decimal, defMult: Decimal) {
    let atk = 0,
      def = 0,
      hp = 0
    for (const [uid, count] of Object.entries(owned.value)) {
      if (count <= 0) continue
      const u = getUnit(uid as UnitId)
      if (!u) continue
      atk += u.attack * atkMult.toNumber() * count
      def += u.defense * defMult.toNumber() * count
      hp += u.hp * count
    }
    return { atk: Math.round(atk), def: Math.round(def), hp }
  }

  // —— actions ——
  /** 训练兵种（入队）；并行槽已满时拒绝（已在队列中的任务不受影响，继续跑完） */
  function startTraining(
    unitId: UnitId,
    count: number,
    canAffordFn: (cost: Record<string, number>) => boolean,
    spendFn: (cost: Record<string, number>) => boolean
  ): boolean {
    const def = getUnit(unitId)
    if (!def || count <= 0) return false
    if (trainingQueue.value.length >= maxTrainingSlots.value) return false
    // 计算总成本
    const totalCost: Record<string, number> = {}
    for (const [res, per] of Object.entries(def.cost)) totalCost[res] = (per as number) * count
    if (!canAffordFn(totalCost)) return false
    if (!spendFn(totalCost)) return false
    const task: TrainingTask = {
      id: 'train_' + ++taskId,
      unitId,
      count,
      remaining: def.trainTime * count,
      totalTime: def.trainTime * count,
    }
    trainingQueue.value.push(task)
    return true
  }

  /**
   * tick：推进训练队列（队列内任务并行推进；入队受 maxTrainingSlots 限制）
   * @returns 本次 tick 完成的兵种及数量 { unitId: count }
   */
  function applyTick(dt: number): Partial<Record<UnitId, number>> {
    if (trainingQueue.value.length === 0) return {}
    const finished: TrainingTask[] = []
    for (const task of trainingQueue.value) {
      task.remaining -= dt
      if (task.remaining <= 0) finished.push(task)
    }
    const completed: Partial<Record<UnitId, number>> = {}
    for (const task of finished) {
      owned.value[task.unitId] += task.count
      completed[task.unitId] = (completed[task.unitId] ?? 0) + task.count
    }
    // 用 filter 重建队列，避免 splice 在遍历时修改数组
    const finishedIds = new Set(finished)
    trainingQueue.value = trainingQueue.value.filter((t) => !finishedIds.has(t))
    return completed
  }

  /** 编入编队 */
  function assignToFormation(formationId: string, unitId: UnitId, count: number): boolean {
    const f = formations.value.find((f) => f.id === formationId)
    if (!f || count <= 0) return false
    if (owned.value[unitId] < count) return false
    owned.value[unitId] -= count
    f.units[unitId] += count
    return true
  }
  /** 从编队撤回 */
  function removeFromFormation(formationId: string, unitId: UnitId, count: number): boolean {
    const f = formations.value.find((f) => f.id === formationId)
    if (!f || count <= 0) return false
    if (f.units[unitId] < count) return false
    f.units[unitId] -= count
    owned.value[unitId] += count
    return true
  }

  /** 消耗编队中的兵（战斗损失） */
  function applyLosses(formation: Formation, losses: Record<UnitId, number>) {
    for (const [uid, loss] of Object.entries(losses)) {
      formation.units[uid as UnitId] = Math.max(0, formation.units[uid as UnitId] - loss)
    }
  }

  function reset() {
    owned.value = { assault: 0, guard: 0, heavy: 0, psionic: 0 }
    trainingQueue.value = []
    formations.value = [
      { id: 'f1', name: '先锋编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
      { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
      { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
    ]
  }

  function serialize() {
    return {
      owned: { ...owned.value },
      training: trainingQueue.value.map((t) => ({ ...t })),
      formations: formations.value.map((f) => ({ ...f, units: { ...f.units } })),
    }
  }
  function hydrate(data: MilitarySaveData | undefined) {
    if (!data) return
    if (data.owned) owned.value = { ...owned.value, ...data.owned }
    if (data.training) trainingQueue.value = data.training.map((t) => ({ ...t }))
    if (data.formations)
      formations.value = data.formations.map((f) => ({ ...f, units: { ...f.units } }))
  }

  return {
    owned,
    trainingQueue,
    formations,
    getOwned,
    totalUnits,
    maxTrainingSlots,
    isUnlocked,
    formationPower,
    totalPower,
    startTraining,
    applyTick,
    assignToFormation,
    removeFromFormation,
    applyLosses,
    reset,
    serialize,
    hydrate,
  }
})
