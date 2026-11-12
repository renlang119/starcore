/**
 * imperial.ts：帝庭据点线 store（v1.80 系统层）
 *
 * 职责：
 * - 6 座帝庭据点的接管状态、整备等级、贡赋池与周巡检状态
 * - 只做状态与纯计算；资源发放 / 战斗结算 / 跨 store 编排由 game 门面包装
 *
 * 生命周期：
 * - 接管、整备、贡赋与巡检均跨转生保留（终局元进度）
 * - hardReset 与存档导入走 game-persistence.resetAllStores，清空本 store
 *
 * 贡赋口径：
 * - 每座按 imperialTributeRate 产资源；池按秒累积，上限 12 小时
 * - 领取后更新 lastClaimAt；新接管据点从 capturedAt 起算，不倒补历史
 * - 巡检逾期只让目标停摆（产出为 0），不直接失守
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ImperialSaveData } from '@/lib/storage'
import type { ResourceType } from '@/data/buildings'
import {
  IMPERIAL_AUDIT_BONUS,
  IMPERIAL_AUDIT_PAY_HOURS,
  IMPERIAL_AUDIT_WINDOW_SECONDS,
  IMPERIAL_CLAIM_CAP_SECONDS,
  IMPERIAL_STRONGHOLDS,
  getImperialStronghold,
  imperialTributeRate,
  imperialUpgradeCost,
  isImperialStrongholdId,
  isLegalImperialTier,
  pickImperialAuditTarget,
} from '@/data/imperial-strongholds'

export type ImperialAuditStatus = 'pending' | 'passed' | 'failed' | 'overdue'

export interface ImperialAuditState {
  /** ISO 周标识（YYYY-Www） */
  week: string
  targetId: string
  /** 处理截止时间（ms） */
  deadline: number
  status: ImperialAuditStatus
  /** 是否通过打点完成（不享受下周加成） */
  paid?: boolean
}

const MAX_TIER = 3

function clampTier(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1
  return Math.min(MAX_TIER, Math.max(1, Math.floor(v)))
}

export const useImperialStore = defineStore('imperial', () => {
  /** 当前接管的据点 id（失守即移除；整备等级保留） */
  const completed = ref<Set<string>>(new Set())
  /** 曾经接管过的据点 id（档案解锁等终身判定用） */
  const everCompleted = ref<Set<string>>(new Set())
  /** 整备等级：id → 1..3 */
  const tiers = ref<Record<string, number>>({})
  /** 接管时刻：id → ms（贡赋从接管起算，不倒补历史） */
  const capturedAt = ref<Record<string, number>>({})
  /** 上次领取贡赋时刻（ms） */
  const lastClaimAt = ref(Date.now())
  /** 巡检通过后的下周贡赋加成（1 / 1.1） */
  const bonus = ref(1)
  /** 当前巡检；null = 未生成或已结算 */
  const audit = ref<ImperialAuditState | null>(null)

  /** 已接管 id，按数据表顺序（周巡检目标选取依赖稳定顺序） */
  const occupiedIds = computed(() =>
    IMPERIAL_STRONGHOLDS.filter((s) => completed.value.has(s.id)).map((s) => s.id)
  )
  const occupiedCount = computed(() => occupiedIds.value.length)

  function tierOf(id: string): number {
    return clampTier(tiers.value[id])
  }

  function isOccupied(id: string): boolean {
    return completed.value.has(id)
  }

  function hasEverCompleted(id: string): boolean {
    return everCompleted.value.has(id)
  }

  /** 接管：写当前与曾接管集合，初始化整备 1 级与接管时刻 */
  function capture(id: string, now = Date.now()): boolean {
    if (!isImperialStrongholdId(id)) return false
    completed.value = new Set(completed.value).add(id)
    everCompleted.value = new Set(everCompleted.value).add(id)
    if (!tiers.value[id]) tiers.value = { ...tiers.value, [id]: 1 }
    capturedAt.value = { ...capturedAt.value, [id]: now }
    return true
  }

  /** 失守：移除接管与接管时刻，整备等级保留 */
  function lose(id: string): void {
    if (!completed.value.has(id)) return
    const next = new Set(completed.value)
    next.delete(id)
    completed.value = next
    const nextAt = { ...capturedAt.value }
    delete nextAt[id]
    capturedAt.value = nextAt
  }

  /** 巡检的生效状态：pending 到期即视为 overdue（不改写引用，刷新走 refreshAudit） */
  function effectiveStatus(now: number): ImperialAuditStatus | null {
    const a = audit.value
    if (!a) return null
    if (a.status === 'pending' && now >= a.deadline) return 'overdue'
    return a.status
  }

  /** 目标是否因逾期停摆 */
  function isSuspended(id: string, now: number): boolean {
    return effectiveStatus(now) === 'overdue' && audit.value?.targetId === id
  }

  /** 单座当前贡赋速率（资源/秒）；停摆返回 0 */
  function rateOf(id: string, best: number, now: number): number {
    const def = getImperialStronghold(id)
    if (!def || !completed.value.has(id) || isSuspended(id, now)) return 0
    return imperialTributeRate(def, best, tierOf(id)) * bonus.value
  }

  /** 逐座速率表：id → 资源/秒（含停摆的 0） */
  function tributeRates(best: number, now = Date.now()): Record<string, number> {
    const out: Record<string, number> = {}
    for (const id of occupiedIds.value) out[id] = rateOf(id, best, now)
    return out
  }

  /** 合并资源速率：资源 → 数量/秒 */
  function tributeTotals(best: number, now = Date.now()): Partial<Record<ResourceType, number>> {
    const out: Partial<Record<ResourceType, number>> = {}
    for (const id of occupiedIds.value) {
      const def = getImperialStronghold(id)
      if (!def) continue
      const rate = rateOf(id, best, now)
      if (rate <= 0) continue
      out[def.resource] = (out[def.resource] ?? 0) + rate
    }
    return out
  }

  /**
   * 贡赋池：按「当前速率 × min(12h, 距上次领取时长)」逐座累积（#23 维持现状）。
   * 停摆期不实时计入（rateOf 归零），但巡检应付后速率恢复，此时领取会把停摆
   * 时段一并按恢复后速率追认，追认量以 12 小时池容为上界（有界近似，
   * 打点成本 24h 总贡赋 > 追认上界，净惩罚方向不变）。
   */
  function pool(best: number, now = Date.now()): Partial<Record<ResourceType, number>> {
    const out: Partial<Record<ResourceType, number>> = {}
    for (const id of occupiedIds.value) {
      const def = getImperialStronghold(id)
      if (!def) continue
      const rate = rateOf(id, best, now)
      if (rate <= 0) continue
      const from = Math.max(lastClaimAt.value, capturedAt.value[id] ?? 0)
      const elapsedSec = Math.max(0, Math.min((now - from) / 1000, IMPERIAL_CLAIM_CAP_SECONDS))
      if (elapsedSec <= 0) continue
      out[def.resource] = (out[def.resource] ?? 0) + rate * elapsedSec
    }
    return out
  }

  /** 领取：返回本次贡赋并把池清零（无接管时也推进 lastClaimAt） */
  function claim(best: number, now = Date.now()): Partial<Record<ResourceType, number>> {
    const bundle = pool(best, now)
    lastClaimAt.value = now
    return bundle
  }

  /** 下一级整备成本；已满级或非法 id 返回 null */
  function upgradeCost(id: string, best: number): Partial<Record<ResourceType, number>> | null {
    const def = getImperialStronghold(id)
    if (!def || !completed.value.has(id)) return null
    const next = tierOf(id) + 1
    if (next > MAX_TIER) return null
    return imperialUpgradeCost(def, best, next)
  }

  /** 扣除成本后调用：提升一级，返回是否成功 */
  function upgrade(id: string): boolean {
    if (!completed.value.has(id)) return false
    const next = tierOf(id) + 1
    if (next > MAX_TIER) return false
    tiers.value = { ...tiers.value, [id]: next }
    return true
  }

  /** 打点成本：24 小时总贡赋（含逾期停摆目标，按当前整备等级计） */
  function auditPayCost(
    best: number,
    now = Date.now()
  ): Partial<Record<ResourceType, number>> | null {
    if (!audit.value || !['pending', 'overdue'].includes(effectiveStatus(now) ?? '')) {
      return null
    }
    const out: Partial<Record<ResourceType, number>> = {}
    for (const id of occupiedIds.value) {
      const def = getImperialStronghold(id)
      if (!def) continue
      const rate = imperialTributeRate(def, best, tierOf(id)) * bonus.value
      out[def.resource] = (out[def.resource] ?? 0) + rate * IMPERIAL_AUDIT_PAY_HOURS * 3600
    }
    return out
  }

  /** 生成当周巡检：同周幂等；上一轮未处理时保持原巡检，不叠加 */
  function ensureAudit(weekKey: string, now = Date.now()): ImperialAuditState | null {
    if (!weekKey || occupiedIds.value.length === 0) {
      audit.value = null
      return null
    }
    if (audit.value?.week === weekKey) return audit.value
    if (audit.value && (audit.value.status === 'pending' || audit.value.status === 'overdue')) {
      return audit.value
    }
    const targetId = pickImperialAuditTarget(occupiedIds.value, weekKey)
    if (!targetId) {
      audit.value = null
      return null
    }
    audit.value = {
      week: weekKey,
      targetId,
      deadline: now + IMPERIAL_AUDIT_WINDOW_SECONDS * 1000,
      status: 'pending',
    }
    return audit.value
  }

  /** tick 调用：pending 到期转 overdue（目标停摆） */
  function refreshAudit(now = Date.now()): void {
    const a = audit.value
    if (!a || a.status !== 'pending') return
    if (now >= a.deadline) audit.value = { ...a, status: 'overdue' }
  }

  /** 迎战胜利：核验通过，下周贡赋 +10% */
  function markAuditPassed(): boolean {
    const a = audit.value
    if (!a || !['pending', 'overdue'].includes(a.status)) return false
    audit.value = { ...a, status: 'passed', paid: false }
    bonus.value = IMPERIAL_AUDIT_BONUS
    return true
  }

  /** 打点通过：目标保留，无下周加成 */
  function markAuditPaid(): boolean {
    const a = audit.value
    if (!a || !['pending', 'overdue'].includes(a.status)) return false
    audit.value = { ...a, status: 'passed', paid: true }
    bonus.value = 1
    return true
  }

  /** 迎战失败：目标失守，整备保留 */
  function markAuditFailed(): boolean {
    const a = audit.value
    if (!a || !['pending', 'overdue'].includes(a.status)) return false
    lose(a.targetId)
    audit.value = { ...a, status: 'failed', paid: false }
    bonus.value = 1
    return true
  }

  function reset(): void {
    completed.value = new Set()
    everCompleted.value = new Set()
    tiers.value = {}
    capturedAt.value = {}
    lastClaimAt.value = Date.now()
    bonus.value = 1
    audit.value = null
  }

  function serialize(): ImperialSaveData {
    return {
      completed: Array.from(completed.value),
      everCompleted: Array.from(everCompleted.value),
      tiers: { ...tiers.value },
      capturedAt: { ...capturedAt.value },
      lastClaimAt: lastClaimAt.value,
      bonus: bonus.value,
      audit: audit.value ? { ...audit.value } : undefined,
    }
  }

  function hydrate(data: ImperialSaveData | undefined): void {
    if (!data) return
    const validIds = new Set(IMPERIAL_STRONGHOLDS.map((s) => s.id))
    if (Array.isArray(data.completed)) {
      completed.value = new Set(
        data.completed.filter((id): id is string => typeof id === 'string' && validIds.has(id))
      )
    }
    if (Array.isArray(data.everCompleted)) {
      everCompleted.value = new Set(
        data.everCompleted.filter((id): id is string => typeof id === 'string' && validIds.has(id))
      )
    }
    // 曾接管集合至少覆盖当前接管集合
    everCompleted.value = new Set([...everCompleted.value, ...completed.value])
    if (data.tiers && typeof data.tiers === 'object') {
      const next: Record<string, number> = {}
      for (const [id, v] of Object.entries(data.tiers)) {
        // 非法条目直接跳过（与 validate 同判据的删除语义，#23：不给非法数据发等级；
        // tierOf 读取侧的 clampTier 保留作运行时兜底）
        if (validIds.has(id) && isLegalImperialTier(v)) next[id] = v
      }
      tiers.value = next
    }
    if (data.capturedAt && typeof data.capturedAt === 'object') {
      const next: Record<string, number> = {}
      for (const [id, v] of Object.entries(data.capturedAt)) {
        if (validIds.has(id) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          next[id] = v
        }
      }
      capturedAt.value = next
    }
    if (typeof data.lastClaimAt === 'number' && Number.isFinite(data.lastClaimAt)) {
      lastClaimAt.value = Math.max(0, data.lastClaimAt)
    }
    bonus.value = data.bonus === IMPERIAL_AUDIT_BONUS ? IMPERIAL_AUDIT_BONUS : 1
    if (
      data.audit &&
      typeof data.audit === 'object' &&
      typeof data.audit.week === 'string' &&
      typeof data.audit.targetId === 'string' &&
      validIds.has(data.audit.targetId) &&
      completed.value.has(data.audit.targetId) &&
      typeof data.audit.deadline === 'number' &&
      Number.isFinite(data.audit.deadline) &&
      ['pending', 'passed', 'failed', 'overdue'].includes(data.audit.status)
    ) {
      audit.value = {
        week: data.audit.week,
        targetId: data.audit.targetId,
        deadline: data.audit.deadline,
        status: data.audit.status,
        paid: data.audit.paid === true,
      }
    } else {
      audit.value = null
    }
  }

  return {
    completed,
    everCompleted,
    tiers,
    capturedAt,
    lastClaimAt,
    bonus,
    audit,
    occupiedIds,
    occupiedCount,
    tierOf,
    isOccupied,
    hasEverCompleted,
    capture,
    lose,
    effectiveStatus,
    isSuspended,
    rateOf,
    tributeRates,
    tributeTotals,
    pool,
    claim,
    upgradeCost,
    upgrade,
    auditPayCost,
    ensureAudit,
    refreshAudit,
    markAuditPassed,
    markAuditPaid,
    markAuditFailed,
    reset,
    serialize,
    hydrate,
  }
})
