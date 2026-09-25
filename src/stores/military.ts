/**
 * military.ts — 造兵与部队系统 store
 * 4 种兵种训练 + 部队编组（最多 3 支编队）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Decimal } from '@/lib/decimal'
import { UNITS, getUnit, defaultFormations, type UnitId, type UnitDef } from '@/data/units'
import { isUnlockedBy } from '@/lib/requires'
import { DEFAULT_TRAIT_ID, TRAITS, type TraitId } from '@/data/traits'
import type { MilitarySaveData } from '@/lib/storage'

/** 特性 id 白名单集合（setFormationTrait 入库校验用） */
const TRAIT_IDS_SET = new Set<string>(TRAITS.map((tr) => tr.id))

export interface Formation {
  id: string
  name: string
  units: Record<UnitId, number> // 兵种 → 数量
  /** 编队特性（v1.23 方案 7，可选字段：旧档缺失视为均衡；未知 id 由读取侧回落） */
  trait?: TraitId
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
  const formations = ref<Formation[]>(defaultFormations())

  let taskId = 0

  // —— getters ——
  const getOwned = (id: UnitId) => owned.value[id]
  const totalUnits = computed(() => Object.values(owned.value).reduce((a, b) => a + b, 0))
  /** 训练并行槽上限（1~3） */
  const maxTrainingSlots = computed(() =>
    Math.min(MAX_TRAINING_SLOTS, Math.max(BASE_TRAINING_SLOTS, trainingSlotProvider()))
  )
  const isUnlocked = (def: UnitDef, completedTechs: Set<string>) =>
    isUnlockedBy(def.requires, completedTechs)

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

  /** 全量持有（库存 + 已编入编队；v0.95 全军口径统一） */
  function totalOwnedOf(id: UnitId): number {
    let total = owned.value[id] ?? 0
    for (const f of formations.value) total += f.units[id] ?? 0
    return total
  }

  /**
   * 全军战力（库存 + 已编入编队全量；v0.95 修正：原只统计库存，
   * 全员编组后面板归零，与「全军」文案不符）
   */
  function totalPower(atkMult: Decimal, defMult: Decimal) {
    let atk = 0,
      def = 0,
      hp = 0
    for (const u of UNITS) {
      const count = totalOwnedOf(u.id)
      if (count <= 0) continue
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

  /** 收编直加入库存（不经训练队列；v1.26 遭遇事件「流浪编队」专用） */
  function addToOwned(unitId: UnitId, count: number): void {
    if (count <= 0) return
    owned.value[unitId] += count
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

  /** 切换编队特性（免费即时生效；未知 id 不入库，返回 false） */
  function setFormationTrait(formationId: string, traitId: TraitId): boolean {
    const f = formations.value.find((f) => f.id === formationId)
    if (!f) return false
    if (traitId !== DEFAULT_TRAIT_ID && !TRAIT_IDS_SET.has(traitId)) return false
    // 均衡为缺省语义：切回均衡时删除字段，存档面保持与旧档同构
    if (traitId === DEFAULT_TRAIT_ID) delete f.trait
    else f.trait = traitId
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
    formations.value = defaultFormations()
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
    if (data.owned) {
      // 兵力取整（防御小数兵力：存档校验已拒非整数，此处兜底直接 hydrate 调用）
      const next = { ...owned.value }
      for (const [uid, n] of Object.entries(data.owned)) {
        if (uid in next && typeof n === 'number' && isFinite(n)) {
          next[uid as UnitId] = Math.max(0, Math.floor(n))
        }
      }
      owned.value = next
    }
    if (data.training) {
      // count 取整兜底（v0.81）：校验层已拒小数，此处兜底直连 hydrate 的调用
      // （完成后 owned += count，小数 count 产小数兵力 → owned intOnly 拒 → 整档判废）
      trainingQueue.value = data.training.map((t) => ({
        ...t,
        count: Math.max(0, Math.floor(t.count)),
      }))
    }
    if (data.formations)
      // units 缺键补零：防 f.units[id] += n 对缺键产 NaN；
      // trait 自愈：不在白名单内的值（含非法形态）回落均衡（undefined = 均衡缺省）
      formations.value = data.formations.map((f) => ({
        ...f,
        trait: f.trait && TRAIT_IDS_SET.has(f.trait) ? (f.trait as TraitId) : undefined,
        units: Object.assign({ assault: 0, guard: 0, heavy: 0, psionic: 0 }, f.units),
      }))
  }

  return {
    owned,
    trainingQueue,
    formations,
    getOwned,
    totalUnits,
    totalOwnedOf,
    maxTrainingSlots,
    isUnlocked,
    formationPower,
    totalPower,
    startTraining,
    addToOwned,
    applyTick,
    assignToFormation,
    removeFromFormation,
    setFormationTrait,
    applyLosses,
    reset,
    serialize,
    hydrate,
  }
})
