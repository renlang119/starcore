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
 * - 巡检合成据点 id = imperial_audit，不入图鉴、不入常规据点通关集；
 * - 炉域（v1.83）无战斗，不设 StrongholdDef：入口门槛、稳定度与倾贡
 *   结算均为纯函数，状态挂 imperial store 的 forge 可选域。
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
/** 转生宽限：转生后首次巡检顺延 7 天（v1.82） */
export const IMPERIAL_AUDIT_GRACE_SECONDS = 7 * 24 * 3600
/** 打点成本：24 小时总贡赋 */
export const IMPERIAL_AUDIT_PAY_HOURS = 24
/** 巡检通过后下周贡赋加成 */
export const IMPERIAL_AUDIT_BONUS = 1.1
/** 从严迎战胜次加成（v1.82：敌方深度 +1，通过后下周贡赋乘数；+30% 与 +25% 强度台阶对价） */
export const IMPERIAL_AUDIT_STRICT_BONUS = 1.3
/** 巡检合成据点 id */
export const IMPERIAL_AUDIT_ID = 'imperial_audit'

// —— 炉域（v1.83）：倾贡与炉火稳定度 ——
/** 炉域入口门槛之一：曾接管全部六座（另一门槛 auditEverPassed 在 store 层） */
export const FORGE_REQUIRED_CAPTURES = 6
/** 炉火稳定度上限 */
export const FORGE_STABILITY_MAX = 100
/** 稳定度每小时衰减（-48/天；满档维持的充分条件为每日 4 次倾贡，+24/次净 +48/天） */
export const FORGE_DECAY_PER_HOUR = 2
/** 每次倾贡回填（固定值；点名资源不加成回填——点名只加产出）。
 * v1.83 复审修正：原 +12 在日限 4 次下 4×12=48 仅打平日衰减（-48），
 * 稳定度永远爬不到 80 档；+24 使 4 次/天净 +48（新档 2 天到顶），
 * 「每日 4 次与维持满档节奏一致」语义严格成立（充分条件）。 */
export const FORGE_TRIBUTE_REFILL = 24
/** 点名资源倾贡产出倍数 */
export const FORGE_PICK_MULT = 3
/** 每日倾贡上限（与维持满档节奏一致：4 次/天对冲 -48/天；不封顶则满档后
 * 以 1.36e9 当量投入换 4.86e10 当量产出净赚约 35 倍，v1.83 复审定） */
export const FORGE_DAILY_LIMIT = 4
/** 单次倾贡产出基准（data，1 档；对价见 forgeYield 注释） */
export const FORGE_YIELD_BASE = 900_000_000
/** 倾贡投入资源：四选一，不含 data（结构隔离防「投 data 得 data」自循环套利） */
export const FORGE_INPUT_RESOURCES = ['energy', 'crystal', 'alloy', 'dark'] as const
export type ForgeInputResource = (typeof FORGE_INPUT_RESOURCES)[number]

/** 单次倾贡投入量（按 EQ 统一 1.36e9 当量：占满档点名产出当量 ≈2.8%，象征性添柴） */
export const FORGE_TRIBUTE_COST: Record<ForgeInputResource, number> = {
  energy: 1_360_000_000,
  crystal: 24_727_000,
  alloy: 1_360_000_000,
  dark: 170_000,
}

/** 稳定度产出档位：80/50/20 三档（线性 ×1/×2/×3），20 以下 0（启动期有意无产出：先添柴后见火） */
export function forgeYieldTier(stability: number): number {
  if (stability >= 80) return 3
  if (stability >= 50) return 2
  if (stability >= 20) return 1
  return 0
}

/** 稳定度离线衰减补算：按小时数线性衰减，到 0 为止（无负值；小时数为正小数） */
export function forgeDecayed(stability: number, hours: number): number {
  if (hours <= 0) return stability
  return Math.max(0, stability - hours * FORGE_DECAY_PER_HOUR)
}

/** 周点名资源：同一周同一资源（fnv1a 周确定性，沿巡检目标模式） */
export function pickForgeResource(weekKey: string): ForgeInputResource {
  const idx = fnv1a(`${weekKey}|forge-pick`) % FORGE_INPUT_RESOURCES.length
  return FORGE_INPUT_RESOURCES[idx] ?? 'energy'
}

/** 是否倾贡投入资源（四选一，不含 data） */
export function isForgeInputResource(v: unknown): v is ForgeInputResource {
  return typeof v === 'string' && (FORGE_INPUT_RESOURCES as readonly string[]).includes(v)
}

/**
 * 单次倾贡产出（data 数量；倾贡即得，无产出池）。
 * 对价锚（v1.83 总账 forge 域，断言 7c）：A 档（best=34）tier1 满接管
 * 六座从严 +30% 一周贡赋加成的总账当量 ≈ 2.27e11 data/周（EQ：energy 1
 * / alloy 1 / data 6 / crystal 55 / dark 8000）；满档点名最优策略
 * （28 次/周 × 3 档 × ×3 点名 × 9e8 基准）= 2.27e11 data/周 ≈ 当量
 * 100% 压线（断言带宽 0.7-1.0，实测 ≈1.0 按 90% 目标定的基准后取整）。
 * 投入为固定量 1.36e9 eq/次（占满档点名产出当量 ≈2.8%，象征性添柴）。
 */
export function forgeYield(stability: number, isPicked: boolean): number {
  const tier = forgeYieldTier(stability)
  if (tier <= 0) return 0
  return Math.round(FORGE_YIELD_BASE * tier * (isPicked ? FORGE_PICK_MULT : 1))
}

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

/** 巡检迎战档位（v1.82）：standard 按整备档基准；strict 敌方深度 +1、胜次加成更高 */
export type ImperialAuditDifficulty = 'standard' | 'strict'

/** 巡检合成据点：深度按目标整备等级上浮（从严 +1），无掉落 */
export function imperialAuditStronghold(
  best: number,
  tier: number,
  difficulty: ImperialAuditDifficulty = 'standard'
): StrongholdDef {
  const level = Math.min(3, Math.max(1, Math.floor(tier)))
  const offset = level >= 3 ? 2 : level === 2 ? 1 : 0
  const depth = Math.max(6, Math.floor(best) + offset + (difficulty === 'strict' ? 1 : 0))
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
