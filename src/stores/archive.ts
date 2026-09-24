/**
 * archive.ts — 档案馆 store（v1.18 可玩内容扩展方案 1）
 *
 * 职责：
 * - 敌方档案（图鉴）：交战即记录遭遇的敌方单位条目（胜负都算「已遭遇」，
 *   与探图见影的直觉一致）；远征合成敌人（endless 前缀名）不入图鉴
 *   ——其编成按深度动态生成，入册会使图鉴无限膨胀
 * - 星图档案不自持：节点剧情回读直接并「当前轮已完成」判定（升级后
 *   当前进度立即可见，与成就终身计数「历史不追溯」同口径）
 *
 * 存档契约：
 * - archive 为可选字段：旧档缺失视为空图鉴，向前收集
 * - 键 = `据点id#序号`（语言无关：同一 unitId 在不同据点换皮，显示名
 *   随语言包走，存档键不随语言重写）
 * - 集合为终身态：转生不清、清档才清（沿用 achievements reset 语义）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ArchiveSaveData } from '@/lib/storage'
import { STRONGHOLDS, STRONGHOLD_TYPES, type EnemyUnit } from '@/data/pve'
import { ENDLESS_STRONGHOLD_ID } from '@/data/endless'
import { WEEKLY_BOSS_ID } from '@/data/weekly-boss'

/** 图鉴条目键：据点 id + 敌方编成序号 */
function enemyKey(strongholdId: string, index: number): string {
  return `${strongholdId}#${index}`
}

/**
 * 敌方种数聚合（v1.22，从 ArchiveView 下沉单一来源）：
 * 按显示名分桶（同 unitId 换皮条目自然合并）；条目键语言无关，
 * 桶数与键面同样语言无关——成就阈值与展示口径共用。
 */
interface EnemyKindBucket {
  type: keyof typeof STRONGHOLD_TYPES
  entries: { key: string; name: string }[]
}

export const ENEMY_KIND_BUCKETS: ReadonlyMap<string, EnemyKindBucket> = (() => {
  const byName = new Map<string, EnemyKindBucket>()
  for (const s of STRONGHOLDS) {
    s.enemies.forEach((e, i) => {
      const bucket = byName.get(e.name) ?? { type: s.type, entries: [] }
      bucket.entries.push({ key: enemyKey(s.id, i), name: e.name })
      byName.set(e.name, bucket)
    })
  }
  return byName
})()

/** 敌方种数（显示名聚合桶数；ach_battle_9 阈值同源） */
export const ENEMY_KIND_TOTAL = ENEMY_KIND_BUCKETS.size

/**
 * 合法图鉴键全集（数据表派生，validate/hydrate 白名单同源）：
 * 正式据点每个敌方编成条目一个键，共 116 个（36 据点）。
 */
export const ARCHIVE_ENEMY_KEYS: ReadonlySet<string> = new Set(
  STRONGHOLDS.flatMap((s) => s.enemies.map((_, i) => enemyKey(s.id, i)))
)

/** 记录一次交战遭遇：该据点全部敌方条目入册（胜负都算，交战即见） */
function encounter(strongholdId: string, enemies: EnemyUnit[], seen: Set<string>): void {
  // 远征合成据点（id='endless'）：动态编成不入图鉴
  if (strongholdId === ENDLESS_STRONGHOLD_ID) return
  // 周 Boss 合成据点（id='weekly_boss'，v1.24）：同口径排除防图鉴无限膨胀
  if (strongholdId === WEEKLY_BOSS_ID) return
  for (let i = 0; i < enemies.length; i++) {
    seen.add(enemyKey(strongholdId, i))
  }
}

export const useArchiveStore = defineStore('archive', () => {
  /** 已遭遇图鉴条目键集合（终身态） */
  const seenEnemies = ref<Set<string>>(new Set())

  const seenCount = computed(() => seenEnemies.value.size)

  /** 已收录敌种数（按显示名聚合桶：桶内任一条目已遭遇即该种已见；v1.22 成就指标） */
  const seenKinds = computed(() => {
    let kinds = 0
    for (const bucket of ENEMY_KIND_BUCKETS.values()) {
      if (bucket.entries.some((e) => seenEnemies.value.has(e.key))) kinds++
    }
    return kinds
  })

  function hasSeen(key: string): boolean {
    return seenEnemies.value.has(key)
  }

  /** 交战遭遇记录（useBattleFlow 出战结算处调用，每次出战一次） */
  function recordEncounter(strongholdId: string, enemies: EnemyUnit[]): void {
    encounter(strongholdId, enemies, seenEnemies.value)
  }

  // —— 生命周期 ——
  /** 转生不清；清档全清（与 achievements.reset 同语义） */
  function reset(): void {
    seenEnemies.value = new Set()
  }

  // —— 序列化 ——
  function serialize(): ArchiveSaveData {
    return { enemies: Array.from(seenEnemies.value) }
  }
  /** 旧档无 archive 字段：空图鉴向前收集；未知键剥离（防注入/损坏） */
  function hydrate(data: ArchiveSaveData | undefined): void {
    if (!data) return
    if (!Array.isArray(data.enemies)) return
    seenEnemies.value = new Set(
      data.enemies.filter((k: unknown) => typeof k === 'string' && ARCHIVE_ENEMY_KEYS.has(k))
    )
  }

  return {
    seenEnemies,
    seenCount,
    seenKinds,
    hasSeen,
    recordEncounter,
    reset,
    serialize,
    hydrate,
  }
})
