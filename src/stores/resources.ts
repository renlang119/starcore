/**
 * resources.ts — 资源 store
 * 5 种资源：energy(能量)、crystal(晶体)、alloy(合金)、data(数据流)、dark(暗物质)
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Decimal, D, add, ser, deser, gte } from '@/lib/decimal'
import type { ResourceType } from '@/data/buildings'
import type { ResourceSaveData } from '@/lib/storage'

export interface ResourceState {
  amount: Decimal
  total: Decimal  // 历史总产出
}

export interface ResourceMeta {
  id: ResourceType
  name: string
  icon: string
  color: string
}

const RES_META: Record<ResourceType, ResourceMeta> = {
  energy: { id: 'energy', name: '能量', icon: 'i-res-energy', color: '#00E5FF' },
  crystal: { id: 'crystal', name: '晶体', icon: 'i-res-crystal', color: '#2EE6A0' },
  alloy: { id: 'alloy', name: '合金', icon: 'i-res-alloy', color: '#FFB627' },
  data: { id: 'data', name: '数据流', icon: 'i-res-data', color: '#A78BFA' },
  dark: { id: 'dark', name: '暗物质', icon: 'i-res-dark', color: '#94A3B8' },
}

export const useResourcesStore = defineStore('resources', () => {
  // —— state ——
  const amounts = ref<Record<ResourceType, Decimal>>({
    energy: D(50),
    crystal: D(0),
    alloy: D(0),
    data: D(0),
    dark: D(0),
  })
  const totals = ref<Record<ResourceType, Decimal>>({
    energy: D(0), crystal: D(0), alloy: D(0), data: D(0), dark: D(0),
  })
  /** 每秒产出（由 game loop 每帧计算并写入） */
  const production = ref<Record<ResourceType, Decimal>>({
    energy: D(0), crystal: D(0), alloy: D(0), data: D(0), dark: D(0),
  })

  // —— getters ——
  const getAmount = (t: ResourceType) => amounts.value[t]
  const getTotal = (t: ResourceType) => totals.value[t]
  const getRate = (t: ResourceType) => production.value[t]
  /** 所有资源的元信息（ widened 为 string 索引，方便消费方用任意 string key 查找） */
  const allMeta: Record<string, ResourceMeta> = RES_META
  const getMeta = (t: ResourceType) => RES_META[t]

  /** 是否负担得起一组成本 */
  const canAfford = (cost: Partial<Record<string, number>> | Record<string, number>) => {
    for (const [k, v] of Object.entries(cost)) {
      if (k in amounts.value && !gte(amounts.value[k as ResourceType], v as number)) return false
    }
    return true
  }

  // —— actions ——
  /** 增加 */
  function gain(t: ResourceType, v: Decimal.Value) {
    amounts.value[t] = add(amounts.value[t], v)
    totals.value[t] = add(totals.value[t], v)
  }
  /** 消耗（返回是否成功） */
  function spend(t: ResourceType, v: Decimal.Value): boolean {
    if (!gte(amounts.value[t], v)) return false
    amounts.value[t] = amounts.value[t].minus(v)
    return true
  }
  /** 一次性消耗一组成本 */
  function spendCost(cost: Partial<Record<string, number>>): boolean {
    if (!canAfford(cost)) return false
    for (const [k, v] of Object.entries(cost)) {
      if (k in amounts.value) amounts.value[k as ResourceType] = amounts.value[k as ResourceType].minus(v as number)
    }
    return true
  }
  /** 直接设置（调试/导入用） */
  function setAmount(t: ResourceType, v: Decimal.Value) {
    amounts.value[t] = D(v)
  }
  /** 设置产出速率 */
  function setProduction(t: ResourceType, v: Decimal.Value) {
    production.value[t] = D(v)
  }
  /** tick 推进：amount += production * dt */
  function applyTick(dt: number) {
    for (const t of Object.keys(amounts.value) as ResourceType[]) {
      const inc = production.value[t].times(dt)
      if (!inc.isZero()) {
        amounts.value[t] = add(amounts.value[t], inc)
        totals.value[t] = add(totals.value[t], inc)
      }
    }
  }
  /** 重置（转生用） */
  function reset(keepDark = false) {
    const darkKeep = keepDark ? amounts.value.dark : D(0)
    amounts.value = { energy: D(50), crystal: D(0), alloy: D(0), data: D(0), dark: darkKeep }
    totals.value = { energy: D(0), crystal: D(0), alloy: D(0), data: D(0), dark: D(0) }
    production.value = { energy: D(0), crystal: D(0), alloy: D(0), data: D(0), dark: D(0) }
  }

  // —— 序列化 ——
  function serialize() {
    return {
      amounts: Object.fromEntries(Object.entries(amounts.value).map(([k, v]) => [k, ser(v)])) as Record<string, string>,
      totals: Object.fromEntries(Object.entries(totals.value).map(([k, v]) => [k, ser(v)])) as Record<string, string>,
    }
  }
  function hydrate(data: ResourceSaveData | undefined) {
    if (!data) return
    for (const k of Object.keys(amounts.value)) {
      if (data.amounts?.[k]) amounts.value[k as ResourceType] = deser(data.amounts[k])
      if (data.totals?.[k]) totals.value[k as ResourceType] = deser(data.totals[k])
    }
  }

  return {
    amounts, totals, production,
    getAmount, getTotal, getRate, allMeta, getMeta,
    canAfford, gain, spend, spendCost, setAmount, setProduction, applyTick, reset,
    serialize, hydrate,
  }
})
