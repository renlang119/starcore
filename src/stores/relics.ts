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
} from '@/data/relics'
import type { RelicSaveData } from '@/lib/storage'

export interface OwnedRelic extends RelicDef {
  instanceId: string
  obtainedAt: number
}

/** 外部传入的槽位扩展数（由 game.ts 注入，避免 setup 阶段隐式依赖 transcend store） */
export type RelicSlotProvider = () => number

const slotProvider = shallowRef<RelicSlotProvider>(() => 0)
export function setRelicSlotProvider(p: RelicSlotProvider) {
  slotProvider.value = p
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
    }
    pushRelic(newRelic)
    return newRelic
  }
  // 辅助：避免 obtain 中 owned 变量名冲突
  function pushRelic(r: OwnedRelic) {
    owned.value.push(r)
  }

  /** 计算当前已装备遗物的所有效果（含套装派生加成，v0.61） */
  const equippedEffects = computed<RelicEffect[]>(() => {
    const list: RelicEffect[] = []
    for (const r of equippedRelics.value) list.push(...r.effects)
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
    if (!nextRarity) return null
    const pool = RELIC_POOL.filter((r) => r.rarity === nextRarity)
    if (pool.length === 0) return null
    const product = pool[Math.floor(rng() * pool.length)]
    // 原子提交：先移除材料再入库产物
    for (const m of materials) discard(m.instanceId)
    return obtain(product)
  }

  /** 获取某类乘数 */
  function getMult(type: RelicEffect['type'], target?: string): number {
    let mult = 1
    for (const eff of equippedEffects.value) {
      if (eff.type !== type) continue
      if (target && eff.target && eff.target !== target && eff.target !== 'all') continue
      mult *= eff.value
    }
    return mult
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
      })),
      equipped: [...equipped.value],
    }
  }
  function hydrate(data: RelicSaveData | undefined) {
    if (!data) return
    if (data.owned) {
      owned.value = data.owned
        .map((r) => {
          // v4+：精简存档，从 RELIC_POOL 补全完整字段
          const def = getRelicById(r.id)
          if (def) {
            return { ...def, instanceId: r.instanceId, obtainedAt: r.obtainedAt }
          }
          // 降级：id 在 RELIC_POOL 中找不到时，尝试从旧格式完整字段恢复
          // 旧格式 owned 条目包含 name/desc/rarity/icon/effects/source
          const legacy = r as Partial<RelicDef>
          if (legacy.name) {
            return {
              id: r.id,
              name: legacy.name,
              desc: legacy.desc ?? '',
              rarity: legacy.rarity ?? 'common',
              icon: legacy.icon ?? 'i-nav-relic',
              effects: legacy.effects ?? [],
              source: legacy.source ?? '',
              instanceId: r.instanceId,
              obtainedAt: r.obtainedAt,
            }
          }
          // 完全无法恢复，跳过该遗物
          return null
        })
        .filter((r): r is OwnedRelic => r !== null) as OwnedRelic[]
    }
    if (data.equipped) {
      const saved = [...data.equipped] as (string | null)[]
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
    getMult,
    reset,
    serialize,
    hydrate,
  }
})
