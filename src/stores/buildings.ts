/**
 * buildings.ts — 建造系统 store
 * 管理各建筑等级、升级成本计算、产出贡献
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { D, Decimal } from '@/lib/decimal'
import {
  BUILDINGS,
  getBuilding,
  buildingCost,
  type BuildingDef,
  type SectorId,
} from '@/data/buildings'
import type { BuildingSaveData } from '@/lib/storage'

export const useBuildingsStore = defineStore('buildings', () => {
  // —— state ——
  const levels = ref<Record<string, number>>({})
  // 初始化所有建筑为 0 级
  for (const b of BUILDINGS) levels.value[b.id] = 0

  // —— getters ——
  const getLevel = (id: string) => levels.value[id] ?? 0
  const isUnlocked = (def: BuildingDef, completedTechs: Set<string>) =>
    !def.requires || completedTechs.has(def.requires)
  const getCost = (id: string) => {
    const def = getBuilding(id)
    if (!def) return {}
    return buildingCost(def, levels.value[id] ?? 0)
  }
  const bySector = (s: SectorId) => BUILDINGS.filter((b) => b.sector === s)

  /**
   * 计算某建筑的当前总产出（所有等级）
   * @param mults 全局乘数 {resourceType: Decimal}
   */
  function getProduction(id: string, mults: Record<string, Decimal>): Record<string, Decimal> {
    const def = getBuilding(id)
    const lvl = levels.value[id] ?? 0
    if (!def || lvl === 0) return {}
    const result: Record<string, Decimal> = {}
    for (const [res, base] of Object.entries(def.produces)) {
      const baseProd = D(base as number).times(lvl)
      const mult = mults[res] ?? D(1)
      result[res] = baseProd.times(mult)
    }
    return result
  }

  /** 获取所有建筑的总产出汇总 */
  function getTotalProduction(mults: Record<string, Decimal>): Record<string, Decimal> {
    const result: Record<string, Decimal> = {
      energy: D(0),
      crystal: D(0),
      alloy: D(0),
      data: D(0),
      dark: D(0),
    }
    for (const b of BUILDINGS) {
      const prod = getProduction(b.id, mults)
      for (const [res, v] of Object.entries(prod)) {
        if (!result[res]) result[res] = D(0)
        result[res] = result[res].plus(v)
      }
    }
    return result
  }

  // —— actions ——
  function upgrade(id: string): boolean {
    const def = getBuilding(id)
    if (!def) return false
    levels.value[id] = (levels.value[id] ?? 0) + 1
    return true
  }
  function setLevel(id: string, lvl: number) {
    levels.value[id] = lvl
  }
  function reset() {
    for (const b of BUILDINGS) levels.value[b.id] = 0
  }

  function serialize() {
    return { levels: { ...levels.value } }
  }
  function hydrate(data: BuildingSaveData | undefined) {
    if (!data?.levels) return
    for (const b of BUILDINGS) {
      if (data.levels[b.id] != null) levels.value[b.id] = data.levels[b.id]
    }
  }

  return {
    levels,
    getLevel,
    isUnlocked,
    getCost,
    bySector,
    getProduction,
    getTotalProduction,
    upgrade,
    setLevel,
    reset,
    serialize,
    hydrate,
  }
})
