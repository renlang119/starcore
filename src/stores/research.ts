/**
 * research.ts — 科技树 store
 * 管理已完成科技集合、解锁状态、科技效果汇总
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { D, Decimal } from '@/lib/decimal'
import { getTech, techAvailable, type TechDef, type TechEffect } from '@/data/tech'
import type { ResearchSaveData } from '@/lib/storage'

export const useResearchStore = defineStore('research', () => {
  // —— state ——
  const completed = ref<Set<string>>(new Set())

  // —— getters ——
  const isCompleted = (id: string) => completed.value.has(id)
  const count = computed(() => completed.value.size)

  /** 科技是否可研究 */
  const available = (def: TechDef) => techAvailable(def, completed.value)

  /** 计算当前所有生效效果（按 type 聚合） */
  const allEffects = computed<TechEffect[]>(() => {
    const list: TechEffect[] = []
    for (const id of completed.value) {
      const tech = getTech(id)
      if (tech) list.push(...tech.effects.filter((e) => e.type !== 'unlock'))
    }
    return list
  })

  /** 某类乘数汇总，如 production_mult / energy → 1.2 * 1.3 = 1.56 */
  function getMult(type: TechEffect['type'], target?: string): Decimal {
    let mult = D(1)
    for (const eff of allEffects.value) {
      if (eff.type !== type) continue
      if (target && eff.target && eff.target !== target && eff.target !== 'all') continue
      mult = mult.times(eff.value)
    }
    return mult
  }

  /** 某类累加值汇总（非乘数型效果，如 training_slot）——EffectSource 接口 */
  function getValue(type: string): number {
    let total = 0
    for (const eff of allEffects.value) {
      if (eff.type === type) total += eff.value
    }
    return total
  }

  // —— actions ——
  function complete(id: string): boolean {
    const def = getTech(id)
    if (!def || completed.value.has(id)) return false
    completed.value.add(id)
    return true
  }

  function reset() {
    completed.value = new Set()
  }

  function serialize() {
    return { completed: Array.from(completed.value) }
  }
  function hydrate(data: ResearchSaveData | undefined) {
    if (!data?.completed) return
    completed.value = new Set(data.completed as string[])
  }

  return {
    completed,
    isCompleted,
    count,
    available,
    allEffects,
    getMult,
    getValue,
    complete,
    reset,
    serialize,
    hydrate,
  }
})
