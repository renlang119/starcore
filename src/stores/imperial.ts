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
  IMPERIAL_AUDIT_GRACE_SECONDS,
  IMPERIAL_AUDIT_PAY_HOURS,
  IMPERIAL_AUDIT_STRICT_BONUS,
  IMPERIAL_AUDIT_WINDOW_SECONDS,
  IMPERIAL_CLAIM_CAP_SECONDS,
  IMPERIAL_STRONGHOLDS,
  getImperialStronghold,
  imperialTributeRate,
  imperialUpgradeCost,
  isImperialStrongholdId,
  isLegalImperialTier,
  pickImperialAuditTarget,
  type ImperialAuditDifficulty,
  FORGE_DAILY_LIMIT,
  FORGE_REQUIRED_CAPTURES,
  FORGE_STABILITY_MAX,
  FORGE_TRIBUTE_REFILL,
  forgeDecayed,
  forgeYield,
  isForgeInputResource,
  pickForgeResource,
  type ForgeInputResource,
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

/** 炉域状态（v1.83）：stability 0-100 线性衰减，lastTick 为上次结算时刻；
 * day 为 UTC 日号（floor(ms/86400000)），dayCount 为当日已倾贡次数（0-4） */
export interface ImperialForgeState {
  stability: number
  lastTick: number
  day: number
  dayCount: number
}

/** UTC 日号（倾贡日限的日界，floor 取整对齐） */
export function forgeDayKey(now: number): number {
  return Math.floor(now / 86_400_000)
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
  /** 转生宽限截止时刻（ms）：此前不生成新巡检（v1.82） */
  const auditGraceUntil = ref(0)
  /** 是否曾通过巡检（终身布尔；v1.83 炉域入口门槛之一，转生不清仅 hardReset 清零） */
  const auditEverPassed = ref(false)
  /** 炉域状态（v1.83；null = 未进入过，进入即初始化 stability 0） */
  const forge = ref<ImperialForgeState | null>(null)

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

  /** 满池判定（v1.82 成就指标）：任一座距上次领取（或接管）满 12 小时即视为满池
   *  （按各座 elapsed 判定，规避多座同资源金额聚合的浮点比较边缘） */
  function poolFull(now = Date.now()): boolean {
    for (const id of occupiedIds.value) {
      const from = Math.max(lastClaimAt.value, capturedAt.value[id] ?? 0)
      if (now - from >= IMPERIAL_CLAIM_CAP_SECONDS * 1000) return true
    }
    return false
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

  /** 转生宽限（v1.82）：转生后首次巡检顺延 7 天，已有待处理巡检的截止时间同步顺延
   *  （以当前时刻与旧截止的较晚者为起点，避免逾期过久的巡检在宽限后仍然停摆） */
  function graceAfterTranscend(now = Date.now()): void {
    const graceMs = IMPERIAL_AUDIT_GRACE_SECONDS * 1000
    auditGraceUntil.value = now + graceMs
    const a = audit.value
    if (a && (a.status === 'pending' || a.status === 'overdue')) {
      audit.value = { ...a, status: 'pending', deadline: Math.max(a.deadline, now) + graceMs }
    }
  }

  /** 生成当周巡检：同周幂等；上一轮未处理时保持原巡检，不叠加 */
  function ensureAudit(weekKey: string, now = Date.now()): ImperialAuditState | null {
    if (!weekKey || occupiedIds.value.length === 0) {
      audit.value = null
      return null
    }
    // 转生宽限内不生成新巡检；已有待处理巡检由 graceAfterTranscend 顺延
    if (now < auditGraceUntil.value) return audit.value
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

  /** 迎战胜利：核验通过，下周贡赋按档位加成（标准 +10% / 从严 +30%，以常量 1.1/1.3 为准） */
  function markAuditPassed(difficulty: ImperialAuditDifficulty = 'standard'): boolean {
    const a = audit.value
    if (!a || !['pending', 'overdue'].includes(a.status)) return false
    audit.value = { ...a, status: 'passed', paid: false }
    bonus.value = difficulty === 'strict' ? IMPERIAL_AUDIT_STRICT_BONUS : IMPERIAL_AUDIT_BONUS
    auditEverPassed.value = true
    return true
  }

  /** 打点通过：目标保留，无下周加成 */
  function markAuditPaid(): boolean {
    const a = audit.value
    if (!a || !['pending', 'overdue'].includes(a.status)) return false
    audit.value = { ...a, status: 'passed', paid: true }
    bonus.value = 1
    auditEverPassed.value = true
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

  // —— 炉域（v1.83）——
  /** 炉域入口门槛：曾接管全部六座 + 曾通过巡检（两门槛均终身事实，跨转生保留） */
  const forgeUnlocked = computed(
    () => everCompleted.value.size >= FORGE_REQUIRED_CAPTURES && auditEverPassed.value
  )

  /** 进入炉域：门槛满足即初始化（幂等，重复进入不重置稳定度）；返回是否成功 */
  function enterForge(now = Date.now()): boolean {
    if (!forgeUnlocked.value) return false
    if (!forge.value)
      forge.value = { stability: 0, lastTick: now, day: forgeDayKey(now), dayCount: 0 }
    return true
  }

  /** 当前稳定度（显示用：衰减补算到 now，不落盘；落盘点在倾贡结算） */
  function forgeStability(now = Date.now()): number {
    if (!forge.value) return 0
    const hours = (now - forge.value.lastTick) / 3_600_000
    return forgeDecayed(forge.value.stability, hours)
  }

  /**
   * 倾贡一次（倾贡即得，无产出池）：投入四选一（不含 data），
   * 衰减补算 → 回填 +12（上限 100）→ 按档位与点名结算产出 → 写回。
   * 资源扣减与发放由 game 门面编排；此处只算状态与产出。
   */
  function tributeForge(
    input: ForgeInputResource,
    weekKey: string,
    now = Date.now()
  ): { yield: number; picked: boolean; stability: number } | null {
    if (!forge.value || !isForgeInputResource(input)) return null
    // 日限：跨日重置计数，当日满额拒绝（返回 null 由界面置禁用态）
    const day = forgeDayKey(now)
    const dayCount = day === forge.value.day ? forge.value.dayCount : 0
    if (dayCount >= FORGE_DAILY_LIMIT) return null
    const decayed = forgeStability(now)
    const stability = Math.min(FORGE_STABILITY_MAX, decayed + FORGE_TRIBUTE_REFILL)
    const picked = input === pickForgeResource(weekKey)
    const amount = forgeYield(stability, picked)
    forge.value = { stability, lastTick: now, day, dayCount: dayCount + 1 }
    return { yield: amount, picked, stability }
  }

  /** 当日剩余倾贡次数（显示用） */
  function forgeRemainingToday(now = Date.now()): number {
    if (!forge.value) return 0
    const day = forgeDayKey(now)
    const used = day === forge.value.day ? forge.value.dayCount : 0
    return Math.max(0, FORGE_DAILY_LIMIT - used)
  }

  function reset(): void {
    completed.value = new Set()
    everCompleted.value = new Set()
    tiers.value = {}
    capturedAt.value = {}
    lastClaimAt.value = Date.now()
    bonus.value = 1
    audit.value = null
    auditGraceUntil.value = 0
    auditEverPassed.value = false
    forge.value = null
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
      auditGraceUntil: auditGraceUntil.value,
      auditEverPassed: auditEverPassed.value || undefined,
      forge: forge.value ? { ...forge.value } : undefined,
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
    auditGraceUntil.value =
      typeof data.auditGraceUntil === 'number' &&
      Number.isFinite(data.auditGraceUntil) &&
      data.auditGraceUntil > 0
        ? data.auditGraceUntil
        : 0
    // 读回白名单：标准/从严加成各自保留，其余（含旧档异常值）回落 1
    bonus.value =
      data.bonus === IMPERIAL_AUDIT_BONUS
        ? IMPERIAL_AUDIT_BONUS
        : data.bonus === IMPERIAL_AUDIT_STRICT_BONUS
          ? IMPERIAL_AUDIT_STRICT_BONUS
          : 1
    auditEverPassed.value = data.auditEverPassed === true
    if (
      data.forge &&
      typeof data.forge.stability === 'number' &&
      Number.isFinite(data.forge.stability) &&
      data.forge.stability >= 0 &&
      data.forge.stability <= FORGE_STABILITY_MAX
    ) {
      // lastTick 非法兜当前时刻（衰减从现在起算）；stability 非法整体剥离（null，重新进入重开）
      forge.value = {
        stability: data.forge.stability,
        lastTick:
          typeof data.forge.lastTick === 'number' && Number.isFinite(data.forge.lastTick)
            ? data.forge.lastTick
            : Date.now(),
        // day/dayCount 非法兜当日零计（v1.83 复审补字段，旧档缺失视为未倾贡）
        day:
          typeof data.forge.day === 'number' && Number.isFinite(data.forge.day)
            ? data.forge.day
            : forgeDayKey(Date.now()),
        dayCount:
          typeof data.forge.dayCount === 'number' &&
          Number.isFinite(data.forge.dayCount) &&
          data.forge.dayCount >= 0
            ? Math.min(FORGE_DAILY_LIMIT, Math.floor(data.forge.dayCount))
            : 0,
      }
    } else {
      forge.value = null
    }
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
    graceAfterTranscend,
    markAuditPassed,
    markAuditPaid,
    markAuditFailed,
    poolFull,
    auditEverPassed,
    forge,
    forgeUnlocked,
    enterForge,
    forgeStability,
    tributeForge,
    forgeRemainingToday,
    reset,
    serialize,
    hydrate,
  }
})
