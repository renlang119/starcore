/**
 * achievements.ts — 成就/里程碑 store（v0.57 玩法扩展方案 2）
 *
 * 职责：
 * - 维护终身计数器（lifetime）：转生会重置单轮进度，本 store 的计数跨转生累计，
 *   仅 hardReset 清零
 * - 阈值比对解锁成就，解锁后进 toast 队列（AppShell 全局提示）
 * - 作为 EffectSource 注册进 EffectSystem：已解锁成就的效果连乘
 *
 * 指标来源分两类：
 * - 终身计数（本 store 自持）：energy/dark（Decimal 防溢出）+
 *   upgrades/maxBuildingLevel/researches/explores/battles/playtime（number）
 * - 外部现值（provider 注入，指标本身跨转生保留）：relicsOwned/transcends
 *   —— 沿用跨 store 派生值的 provider 注入模式（同 setRelicSlotProvider）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { D, Decimal, add, ser, deser } from '@/lib/decimal'
import type { AchievementsSaveData } from '@/lib/storage'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  type AchievementMetric,
  type AchievementEffect,
} from '@/data/achievements'

/** 终身计数中的大数指标（Decimal） */
export type BigLifetimeKey = 'energy' | 'dark'
/** 终身计数中的整数指标（number） */
export type IntLifetimeKey = 'upgrades' | 'maxBuildingLevel' | 'researches' | 'explores' | 'battles'
/** 读外部现值的指标（不自持计数；playtime = game store 的 totalPlayTime，已入档） */
export type ExternalMetric =
  'relicsOwned' | 'relicKinds' | 'transcends' | 'playtime' | 'expeditionBest'

export type LifetimeMetric = BigLifetimeKey | IntLifetimeKey

const INT_KEYS: IntLifetimeKey[] = [
  'upgrades',
  'maxBuildingLevel',
  'researches',
  'explores',
  'battles',
]

/** 外部现值指标 provider，由 game store 注入 */
type ExternalProvider = () => number
let externalProviders: Partial<Record<ExternalMetric, ExternalProvider>> = {}
export function setAchievementExternalProviders(providers: {
  relicsOwned: ExternalProvider
  relicKinds: ExternalProvider
  transcends: ExternalProvider
  playtime: ExternalProvider
  expeditionBest: ExternalProvider
}): void {
  externalProviders = providers
}

export interface AchievementToast {
  id: string
  name: string
  /** 入队时间戳（ms） */
  at: number
}

function emptyLifetimeBig(): Record<BigLifetimeKey, Decimal> {
  return { energy: D(0), dark: D(0) }
}
function emptyLifetimeInt(): Record<IntLifetimeKey, number> {
  return { upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 }
}

export const useAchievementsStore = defineStore('achievements', () => {
  // —— 终身计数（转生不清，仅 hardReset 清零）——
  const lifetimeBig = ref<Record<BigLifetimeKey, Decimal>>(emptyLifetimeBig())
  const lifetimeInt = ref<Record<IntLifetimeKey, number>>(emptyLifetimeInt())
  /** 已解锁成就：id → 解锁时间戳（ms） */
  const unlocked = ref<Record<string, number>>({})
  /** 待展示 toast 队列（AppShell 消费后调 shiftToast 移除） */
  const toastQueue = ref<AchievementToast[]>([])

  const unlockedCount = computed(() => Object.keys(unlocked.value).length)

  /** 指标当前值（统一归一为 number 用于阈值比对；1e12 阈值内 double 精度安全） */
  function metricValue(metric: AchievementMetric): number {
    if (metric === 'relicsOwned') return externalProviders.relicsOwned?.() ?? 0
    if (metric === 'relicKinds') return externalProviders.relicKinds?.() ?? 0
    if (metric === 'transcends') return externalProviders.transcends?.() ?? 0
    if (metric === 'playtime') return externalProviders.playtime?.() ?? 0
    if (metric === 'expeditionBest') return externalProviders.expeditionBest?.() ?? 0
    if (metric === 'energy') return lifetimeBig.value.energy.toNumber()
    if (metric === 'dark') return lifetimeBig.value.dark.toNumber()
    return lifetimeInt.value[metric as IntLifetimeKey] ?? 0
  }

  /** 进度（0~1，UI 进度条用） */
  function progressOf(metric: AchievementMetric, threshold: number): number {
    return Math.min(1, metricValue(metric) / threshold)
  }

  function isUnlocked(id: string): boolean {
    return unlocked.value[id] !== undefined
  }

  // —— 终身计数累计接口（由 game store 钩子调用）——
  function addEnergy(v: Decimal.Value): void {
    lifetimeBig.value.energy = add(lifetimeBig.value.energy, v)
  }
  function addDark(v: Decimal.Value): void {
    lifetimeBig.value.dark = add(lifetimeBig.value.dark, v)
  }
  function recordUpgrade(newLevel: number): void {
    lifetimeInt.value.upgrades++
    if (newLevel > lifetimeInt.value.maxBuildingLevel) {
      lifetimeInt.value.maxBuildingLevel = newLevel
    }
  }
  function recordResearch(): void {
    lifetimeInt.value.researches++
  }
  function recordExplore(): void {
    lifetimeInt.value.explores++
  }
  function recordBattle(): void {
    lifetimeInt.value.battles++
  }

  /**
   * 全表扫描解锁判定（37 条，tick 尾部每秒一次，开销可忽略）。
   * 新解锁成就入 toast 队列并返回定义列表。
   */
  function checkAndUnlock(): typeof ACHIEVEMENTS {
    const fresh: typeof ACHIEVEMENTS = []
    const now = Date.now()
    for (const def of ACHIEVEMENTS) {
      if (unlocked.value[def.id] !== undefined) continue
      if (metricValue(def.metric) >= def.threshold) {
        unlocked.value[def.id] = now
        toastQueue.value.push({ id: def.id, name: def.name, at: now })
        fresh.push(def)
      }
    }
    return fresh
  }

  function shiftToast(): void {
    toastQueue.value.shift()
  }

  // —— EffectSource 实现 ——
  /** 已解锁成就的效果汇总 */
  const allEffects = computed(() => {
    const list: AchievementEffect[] = []
    for (const def of ACHIEVEMENTS) {
      if (unlocked.value[def.id] !== undefined) list.push(...def.effects)
    }
    return list
  })

  function getMult(type: string, target?: string): Decimal {
    let m = D(1)
    for (const eff of allEffects.value) {
      if (eff.type !== type) continue
      if (target && eff.target && eff.target !== target && eff.target !== 'all') continue
      m = m.times(eff.value)
    }
    return m
  }

  // —— 生命周期 ——
  /** 转生不清；hardReset 全清 */
  function reset(): void {
    lifetimeBig.value = emptyLifetimeBig()
    lifetimeInt.value = emptyLifetimeInt()
    unlocked.value = {}
    toastQueue.value = []
  }

  // —— 序列化 ——
  function serialize(): AchievementsSaveData {
    return {
      lifetime: {
        energy: ser(lifetimeBig.value.energy),
        dark: ser(lifetimeBig.value.dark),
        ...lifetimeInt.value,
      },
      unlocked: { ...unlocked.value },
    }
  }
  /**
   * 旧档无 achievements 字段：data 为 undefined，终身计数从零起算。
   * 历史产量不追溯（无数据来源）；hydrate 后首次 checkAndUnlock 会按当时
   * 可见现值补发遗物/转生类成就。
   */
  function hydrate(data: AchievementsSaveData | undefined): void {
    if (!data) return
    const lt = data.lifetime
    if (lt && typeof lt === 'object') {
      if (typeof lt.energy === 'string') lifetimeBig.value.energy = deser(lt.energy)
      if (typeof lt.dark === 'string') lifetimeBig.value.dark = deser(lt.dark)
      for (const k of INT_KEYS) {
        const v = lt[k]
        if (typeof v === 'number' && isFinite(v) && v >= 0) lifetimeInt.value[k] = Math.floor(v)
      }
    }
    if (data.unlocked && typeof data.unlocked === 'object') {
      for (const [id, ts] of Object.entries(data.unlocked)) {
        // 只认已知成就 id + 合法时间戳（防注入/损坏）
        if (ACHIEVEMENT_IDS.has(id) && typeof ts === 'number' && isFinite(ts) && ts >= 0) {
          unlocked.value[id] = ts
        }
      }
    }
  }

  return {
    lifetimeBig,
    lifetimeInt,
    unlocked,
    toastQueue,
    unlockedCount,
    allEffects,
    metricValue,
    progressOf,
    isUnlocked,
    addEnergy,
    addDark,
    recordUpgrade,
    recordResearch,
    recordExplore,
    recordBattle,
    checkAndUnlock,
    shiftToast,
    getMult,
    reset,
    serialize,
    hydrate,
  }
})
