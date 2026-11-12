/**
 * imperial-strongholds.ts：帝庭据点线数据（v1.80 系统层）
 *
 * 6 座帝庭据点沿贡道分布，接管后产出贡赋；数值锚定 EV 总账 A 档
 * （best=34）三路派遣稳态的 5%，B/C 档按 dispatchRewardScale 同比例缩放。
 * 战斗编成复用 endlessStronghold 的四族模板，不新增 unitId；接管战斗
 * 难度整体低于每周巡检，避免刚转生时无法推进。
 *
 * 数据契约：
 * - 据点 id 固定 imp_*，不进 STRONGHOLDS 表，也不进常规据点通关集；
 * - 全部据点需先完成银盘枢纽（node_galaxy_hub），再满足各自节点与接管数；
 * - 巡检合成据点 id = imperial_audit，不入图鉴、不入常规据点通关集。
 */
import { t } from '@/i18n'
import type { StrongholdDef } from './pve'
import type { ResourceType } from './buildings'
import { endlessStronghold } from './endless'
import { dispatchRewardScale } from './dispatch'
import { fnv1a } from '@/lib/random'

/** 贡赋基准档：EV 总账 A 档（best=34） */
export const IMPERIAL_ANCHOR_BEST = 34
/** 满接管贡赋 = 三路派遣稳态当量的 5%（设计目标，非运行时读取） */
export const IMPERIAL_TRIBUTE_SHARE = 0.05
/** 贡赋池累积上限：12 小时 */
export const IMPERIAL_CLAIM_CAP_SECONDS = 12 * 3600
/** 整备每级倍率：2 级 ×1.3，3 级 ×1.69 */
export const IMPERIAL_TIER_MULT = 1.3
export const IMPERIAL_TIER3_MULT = 1.69
/** 巡检窗口：72 小时 */
export const IMPERIAL_AUDIT_WINDOW_SECONDS = 72 * 3600
/** 打点成本：24 小时总贡赋 */
export const IMPERIAL_AUDIT_PAY_HOURS = 24
/** 巡检通过后下周贡赋加成 */
export const IMPERIAL_AUDIT_BONUS = 1.1
/** 巡检合成据点 id */
export const IMPERIAL_AUDIT_ID = 'imperial_audit'

/**
 * 整备等级合法性：1..3 的整数（validate 与 hydrate 共用的条目判据；
 * 两处统一为删除语义：非法条目剥离后 tierOf 回落 1，不钳制发放等级）
 */
export function isLegalImperialTier(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 3
}

export interface ImperialStrongholdDef {
  id: string
  name: string
  desc: string
  /** 贡赋资源（单资源，按当量均分六座） */
  resource: ResourceType
  /** A 档（best=34）每秒贡赋基准 */
  baseRate: number
  /** 解锁所需探索节点（另需银盘枢纽全局门槛） */
  requires: string
  /** 解锁所需已接管数（第 6 座 = 5） */
  requiresCaptured?: number
  /** 接管战斗相对 expeditionBest 的深度偏移 */
  depthOffset: number
  /** 展示层级 */
  tier: number
}

/** 6 座帝庭据点（有序：贡道关 → 炉前庭） */
export const IMPERIAL_STRONGHOLDS: ImperialStrongholdDef[] = [
  {
    id: 'imp_pass',
    name: t('content.imperialStrongholds.imp_pass.name'),
    desc: t('content.imperialStrongholds.imp_pass.desc'),
    resource: 'energy',
    baseRate: 1_250_000,
    requires: 'node_arm_gate',
    depthOffset: -3,
    tier: 1,
  },
  {
    id: 'imp_audit',
    name: t('content.imperialStrongholds.imp_audit.name'),
    desc: t('content.imperialStrongholds.imp_audit.desc'),
    resource: 'data',
    baseRate: 208_333,
    requires: 'node_arm_spine',
    depthOffset: -2,
    tier: 2,
  },
  {
    id: 'imp_guard',
    name: t('content.imperialStrongholds.imp_guard.name'),
    desc: t('content.imperialStrongholds.imp_guard.desc'),
    resource: 'alloy',
    baseRate: 1_250_000,
    requires: 'node_arm_cradle',
    depthOffset: -1,
    tier: 3,
  },
  {
    id: 'imp_verdict',
    name: t('content.imperialStrongholds.imp_verdict.name'),
    desc: t('content.imperialStrongholds.imp_verdict.desc'),
    resource: 'crystal',
    baseRate: 22_727,
    requires: 'node_galaxy_range',
    depthOffset: 0,
    tier: 4,
  },
  {
    id: 'imp_echo',
    name: t('content.imperialStrongholds.imp_echo.name'),
    desc: t('content.imperialStrongholds.imp_echo.desc'),
    resource: 'dark',
    baseRate: 156.25,
    requires: 'node_galaxy_halo',
    depthOffset: 0,
    tier: 5,
  },
  {
    id: 'imp_court',
    name: t('content.imperialStrongholds.imp_court.name'),
    desc: t('content.imperialStrongholds.imp_court.desc'),
    resource: 'energy',
    baseRate: 1_250_000,
    requires: 'node_galaxy_hub',
    requiresCaptured: 5,
    depthOffset: 1,
    tier: 6,
  },
]

const IMPERIAL_BY_ID = new Map(IMPERIAL_STRONGHOLDS.map((s) => [s.id, s]))

export function getImperialStronghold(id: string): ImperialStrongholdDef | undefined {
  return IMPERIAL_BY_ID.get(id)
}

export function isImperialStrongholdId(id: string): boolean {
  return IMPERIAL_BY_ID.has(id)
}

/** 解锁：银盘枢纽全局门槛 + 各自节点 + 接管数 */
export function imperialUnlocked(
  def: ImperialStrongholdDef,
  completedNodes: ReadonlySet<string>,
  capturedCount: number
): boolean {
  return (
    completedNodes.has('node_galaxy_hub') &&
    completedNodes.has(def.requires) &&
    capturedCount >= (def.requiresCaptured ?? 0)
  )
}

/** 贡赋缩放：以 A 档为 1，按派遣奖励曲线同比例增长（best<34 时低于 1） */
export function imperialTributeScale(best: number): number {
  return dispatchRewardScale(best) / dispatchRewardScale(IMPERIAL_ANCHOR_BEST)
}

/** 单座贡赋速率（资源/秒）；tier 取 1..3 */
export function imperialTributeRate(
  def: ImperialStrongholdDef,
  best: number,
  tier: number
): number {
  const level = Math.min(3, Math.max(1, Math.floor(tier)))
  const mult = level >= 3 ? IMPERIAL_TIER3_MULT : level === 2 ? IMPERIAL_TIER_MULT : 1
  return def.baseRate * imperialTributeScale(best) * mult
}

/** 单座整备成本：按 1 级贡赋的 24h / 72h 计，收取该据点贡赋资源 */
export function imperialUpgradeCost(
  def: ImperialStrongholdDef,
  best: number,
  targetTier: number
): Partial<Record<ResourceType, number>> | null {
  if (targetTier !== 2 && targetTier !== 3) return null
  const hours = targetTier === 2 ? 24 : 72
  const rate = imperialTributeRate(def, best, 1)
  return { [def.resource]: Math.round(rate * hours * 3600) }
}

/** 接管战斗：复用 endless 四族模板，按 best + depthOffset 缩放，奖励与驻扎清空 */
export function imperialBattleStronghold(def: ImperialStrongholdDef, best: number): StrongholdDef {
  const depth = Math.max(6, Math.floor(best) + def.depthOffset)
  const base = endlessStronghold(depth)
  return {
    ...base,
    id: def.id,
    name: def.name,
    type: 'imperial',
    tier: def.tier,
    desc: def.desc,
    rewards: {},
    idle: {},
    requires: def.requires,
    imperial: true,
  }
}

/** 巡检合成据点：深度按目标整备等级上浮，无掉落 */
export function imperialAuditStronghold(best: number, tier: number): StrongholdDef {
  const level = Math.min(3, Math.max(1, Math.floor(tier)))
  const offset = level >= 3 ? 2 : level === 2 ? 1 : 0
  const depth = Math.max(6, Math.floor(best) + offset)
  const base = endlessStronghold(depth)
  return {
    ...base,
    id: IMPERIAL_AUDIT_ID,
    name: t('content.imperialStrongholds.audit.name'),
    type: 'imperial',
    tier: level,
    desc: t('content.imperialStrongholds.audit.desc'),
    rewards: {},
    idle: {},
    imperial: true,
  }
}

/** 每周巡检目标：同一周同一目标，输入顺序须稳定（按数据表顺序） */
export function pickImperialAuditTarget(
  occupiedIds: readonly string[],
  weekKey: string
): string | null {
  if (occupiedIds.length === 0) return null
  const idx = fnv1a(`${weekKey}|imperial-audit`) % occupiedIds.length
  return occupiedIds[idx] ?? null
}
