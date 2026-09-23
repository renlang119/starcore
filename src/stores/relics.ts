/**
 * relics.ts — 遗物系统 store
 * 收集遗物、装备到槽位（基础 4 个槽位，可通过转生树 t_slot 扩展）
 */
import { defineStore } from 'pinia'
import { ref, computed, watch, shallowRef } from 'vue'
import {
  type RelicDef,
  type RelicEffect,
  getRelicById,
  RELIC_POOL,
  RELIC_SETS,
  getSetByRelic,
  MAX_RELIC_LEVEL,
  ENHANCE_GAIN,
  enhanceCost,
  enhanceValue,
  enhanceLabel,
} from '@/data/relics'
import { aggregateMult } from '@/lib/effect-system'
import { repeatUntilFail } from '@/lib/batch'
import type { RelicSaveData } from '@/lib/storage'

export interface OwnedRelic extends RelicDef {
  instanceId: string
  obtainedAt: number
  /** 强化等级（v0.70，instance 级，0-20；旧档缺失默认 0） */
  level: number
}

/** 外部传入的槽位扩展数（由 game.ts 注入，避免 setup 阶段隐式依赖 transcend store） */
export type RelicSlotProvider = () => number

const slotProvider = shallowRef<RelicSlotProvider>(() => 0)
export function setRelicSlotProvider(p: RelicSlotProvider) {
  slotProvider.value = p
}

/** 强化能量支出通道（由 game.ts 注入 resources.spend，避免 relics 隐式依赖 resources） */
export type RelicEnhanceSpendProvider = (cost: number) => boolean

const enhanceSpend = shallowRef<RelicEnhanceSpendProvider>(() => false)
export function setRelicEnhanceSpendProvider(p: RelicEnhanceSpendProvider) {
  enhanceSpend.value = p
}

/** 合成计数通道（v1.21 周挑战扩类：由 game-effects 注入 daily.bump，同注入先例） */
export type RelicSynthCountProvider = () => void

const synthCount = shallowRef<RelicSynthCountProvider>(() => {})
export function setRelicSynthCountProvider(p: RelicSynthCountProvider) {
  synthCount.value = p
}

/** 强化后效果副本（视图展示与 equippedEffects 共用；0 级返回原始效果） */
export function enhancedEffectsOf(relic: OwnedRelic): RelicEffect[] {
  if (relic.level <= 0) return relic.effects
  return relic.effects.map((eff) => {
    const gain = ENHANCE_GAIN[eff.type]
    if (!gain) return eff
    return {
      ...eff,
      value: enhanceValue(eff.value, gain, relic.level),
      label: enhanceLabel(eff.label, eff.value, gain, relic.level),
    }
  })
}

export const useRelicsStore = defineStore('relics', () => {
  const owned = ref<OwnedRelic[]>([])
  /** 槽位上限：基础 4 + 转生树 relic_slot 加成（由 game.ts 注入） */
  const maxSlots = computed(() => 4 + slotProvider.value())
  const equipped = ref<(string | null)[]>([null, null, null, null])

  // 槽位数随转生树购买扩展（或回退保持对齐）
  watch(
    maxSlots,
    (newMax) => {
      const cur = equipped.value.length
      if (newMax > cur) {
        for (let i = cur; i < newMax; i++) equipped.value.push(null)
      } else if (newMax < cur) {
        // 收缩：把超出的槽位中的遗物卸下
        equipped.value.length = newMax
      }
    },
    { immediate: true }
  )

  const ownedCount = computed(() => owned.value.length)
  const equippedRelics = computed(
    () =>
      equipped.value
        .map((id) => owned.value.find((r) => r.instanceId === id))
        .filter(Boolean) as OwnedRelic[]
  )

  /** 装备某遗物到槽位 */
  function equip(instanceId: string, slot: number): boolean {
    if (slot < 0 || slot >= maxSlots.value) return false
    const relic = owned.value.find((r) => r.instanceId === instanceId)
    if (!relic) return false
    // 先从其他槽位移除
    for (let i = 0; i < equipped.value.length; i++) {
      if (equipped.value[i] === instanceId) equipped.value[i] = null
    }
    equipped.value[slot] = instanceId
    return true
  }
  function unequip(slot: number) {
    if (slot >= 0 && slot < maxSlots.value) equipped.value[slot] = null
  }
  function isEquipped(instanceId: string): boolean {
    return equipped.value.includes(instanceId)
  }

  /** 丢弃遗物：若已装备先卸下，再从 owned 移除 */
  function discard(instanceId: string): boolean {
    // 先从所有槽位移除
    for (let i = 0; i < equipped.value.length; i++) {
      if (equipped.value[i] === instanceId) equipped.value[i] = null
    }
    const idx = owned.value.findIndex((r) => r.instanceId === instanceId)
    if (idx === -1) return false
    owned.value.splice(idx, 1)
    return true
  }

  /** 获得新遗物 */
  function obtain(relic: RelicDef): OwnedRelic {
    const newRelic: OwnedRelic = {
      ...relic,
      instanceId: 'relic_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      obtainedAt: Date.now(),
      level: 0,
    }
    owned.value.push(newRelic)
    return newRelic
  }

  /** 计算当前已装备遗物的所有效果（含强化放大与套装派生加成，v0.61/v0.70） */
  const equippedEffects = computed<RelicEffect[]>(() => {
    const list: RelicEffect[] = []
    for (const r of equippedRelics.value) list.push(...enhancedEffectsOf(r))
    for (const s of activeSetBonuses.value) {
      if (s.mode === 'partial') list.push(s.set.partial)
      else list.push(s.set.full)
    }
    return list
  })

  // —— 套装（v0.61）：按装备中遗物的所属系别统计件数 ——
  const setProgress = computed(() => {
    const rows = RELIC_SETS.map((set) => ({
      set,
      count: 0,
      mode: 'none' as 'none' | 'partial' | 'full',
    }))
    const idx = new Map(rows.map((r, i) => [r.set.id, i]))
    for (const r of equippedRelics.value) {
      const set = getSetByRelic(r.id)
      if (set) rows[idx.get(set.id)!].count++
    }
    for (const row of rows) {
      row.mode = row.count >= 3 ? 'full' : row.count >= 2 ? 'partial' : 'none'
    }
    return rows
  })

  /** 已激活的套装加成（partial/full），供 equippedEffects 聚合 */
  const activeSetBonuses = computed(() => setProgress.value.filter((r) => r.mode !== 'none'))

  /** 遗物图鉴种类数（distinct id，不计重复件）——ach_relic_4 用 */
  const ownedKinds = computed(() => new Set(owned.value.map((r) => r.id)).size)

  // —— 合成（v0.61）：3 件同稀有度未装备遗物 → 高一档随机产物 ——
  /** 稀有度升阶链（legendary 为顶档，不可作为材料） */
  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'] as const

  /**
   * 遗物合成：消耗 3 件同稀有度未装备遗物，产出高一档稀有度池中的随机一件。
   * 校验失败返回 null（不做任何变动）；成功移除材料、产物入库并返回。
   */
  function synthesize(instanceIds: string[], rng: () => number = Math.random): OwnedRelic | null {
    if (instanceIds.length !== 3) return null
    if (new Set(instanceIds).size !== 3) return null
    const materials: OwnedRelic[] = []
    for (const id of instanceIds) {
      const relic = owned.value.find((r) => r.instanceId === id)
      if (!relic) return null
      if (isEquipped(id)) return null
      if (relic.rarity === 'legendary') return null
      materials.push(relic)
    }
    const rarity = materials[0].rarity
    if (!materials.every((m) => m.rarity === rarity)) return null
    const nextRarity = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) + 1]
    const pool = RELIC_POOL.filter((r) => r.rarity === nextRarity)
    if (pool.length === 0) return null
    const product = pool[Math.floor(rng() * pool.length)]
    // 原子提交：先移除材料再入库产物
    for (const m of materials) discard(m.instanceId)
    synthCount.value()
    return obtain(product)
  }

  /** 获取某类乘数（对外保持 number 契约，聚合逻辑委托 lib） */
  function getMult(type: RelicEffect['type'], target?: string): number {
    return aggregateMult(equippedEffects.value, type, target).toNumber()
  }

  // —— 强化（v0.70）：instance 级等级轴 ——

  /** 该遗物下一级能量成本（满级返回 null） */
  function nextEnhanceCost(instanceId: string): number | null {
    const relic = owned.value.find((r) => r.instanceId === instanceId)
    if (!relic || relic.level >= MAX_RELIC_LEVEL) return null
    return enhanceCost(relic.rarity, relic.level + 1)
  }

  /**
   * 强化 1 级：校验存在/未满级 → 扣能量 → level+1；任一失败零副作用返回 false。
   * 能量支出走注入的 enhanceSpend 通道（game.ts 接入 resources.spend）。
   */
  function enhance(instanceId: string): boolean {
    const relic = owned.value.find((r) => r.instanceId === instanceId)
    if (!relic) return false
    if (relic.level >= MAX_RELIC_LEVEL) return false
    const cost = enhanceCost(relic.rarity, relic.level + 1)
    if (!enhanceSpend.value(cost)) return false
    relic.level += 1
    return true
  }

  /**
   * 批量强化遗物（v0.86）：至多 steps 级、买满语义。
   * 逐级复用 enhance（每级成本按新等级重算），能量不足或达 20 级
   * 上限自然停止；返回实际完成级数（0 = 一级都买不起）。
   */
  function enhanceSteps(instanceId: string, steps: number): number {
    return repeatUntilFail(steps, () => enhance(instanceId))
  }

  function reset() {
    owned.value = []
    equipped.value = new Array(maxSlots.value).fill(null)
  }

  function serialize() {
    return {
      owned: owned.value.map((r) => ({
        id: r.id,
        instanceId: r.instanceId,
        obtainedAt: r.obtainedAt,
        level: r.level,
      })),
      equipped: [...equipped.value],
    }
  }
  function hydrate(data: RelicSaveData | undefined) {
    if (!data) return
    if (data.owned) {
      owned.value = data.owned
        .map((r) => {
          // 从 RELIC_POOL 补全完整字段；id 不在池中（损坏数据）跳过
          const def = getRelicById(r.id)
          if (!def) return null
          return {
            ...def,
            instanceId: r.instanceId,
            obtainedAt: r.obtainedAt,
            level: Math.min(MAX_RELIC_LEVEL, Math.max(0, r.level ?? 0)),
          }
        })
        .filter((r): r is OwnedRelic => r !== null) as OwnedRelic[]
    }
    if (data.equipped) {
      const saved = [...data.equipped] as (string | null)[]
      // 引用修复：槽位必须指向 owned 中的实例且不重复（导入或手改存档可产生
      // 重复/悬空引用，同一实例重复占槽会双计装备效果与套装件数）；
      // 校验层 _validateAndRepair 已修一轮，这里对 hydrate 直呼路径同样防御
      const known = new Set(owned.value.map((r) => r.instanceId))
      const seen = new Set<string>()
      for (let i = 0; i < saved.length; i++) {
        const id = saved[i]
        if (id === null || !known.has(id) || seen.has(id)) {
          saved[i] = null
          continue
        }
        seen.add(id)
      }
      // 对齐当前 maxSlots：缺失补 null，超出截断
      const target = maxSlots.value
      while (saved.length < target) saved.push(null)
      if (saved.length > target) saved.length = target
      equipped.value = saved
    }
  }

  return {
    owned,
    equipped,
    ownedCount,
    ownedKinds,
    equippedRelics,
    equippedEffects,
    setProgress,
    maxSlots,
    equip,
    unequip,
    isEquipped,
    obtain,
    discard,
    synthesize,
    nextEnhanceCost,
    enhance,
    enhanceSteps,
    getMult,
    reset,
    serialize,
    hydrate,
  }
})
