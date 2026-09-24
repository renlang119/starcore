/**
 * weekly-boss.ts — 每周强敌（周 Boss）定义（v1.24 可玩内容扩展方案 5）
 *
 * 每周一（ISO 周，与周期挑战同轨）刷新一只强化据点 Boss：
 * 编成 = 远征 4 模板之一（周种子洗牌取 1，克制考题每周变）
 *        × TEMPLATE_NORMALIZE 强度归一 × endlessScale(bossDepth)；
 * bossDepth = max(6, expeditionBest + OFFSET[模板])——锚玩家终身远征前沿，
 * 模板偏移把四类编成的 50% 墙位结构差对齐（六轮战斗模拟校准定稿，
 * 2026-09-24）。
 *
 * 难度曲线：推进中玩家（墙−4 及以前）Boss 全模板全胜（周津贴）；
 * 卡墙玩家（墙位）胜率落 [15%, 85%]（可过且非白给）；破墙后 Boss 随
 * 前沿上移自校准，永远有下一只。
 *
 * 奖励 = endlessStronghold(max(6, expeditionBest + 1)) 全套 × 1.5——
 * 锚玩家前沿、与模板解耦（消除「难的模板周反而奖金低」错位）；
 * 量级 = 1.5 场前沿远征单场，周频一次性，不构成第二资源轴。
 *
 * 数据契约：
 * - 合成据点 id = 'weekly_boss'，不入 STRONGHOLDS 表（与 endless 同口径：
 *   严禁进 completedStrongholds，白名单会拒档）；不入敌方图鉴（动态编成）；
 * - 模板轮换表与 endless 各自独立冻结（endless 的 TEMPLATE_IDS 不受影响）；
 * - 周种子确定性：同周同 best 取同一 Boss（fnv1a(week) 洗牌，与挑战池同族）。
 */
import { t } from '@/i18n'
import type { StrongholdDef } from './pve'
import { STRONGHOLDS } from './pve'
import { endlessStronghold, endlessScale, type MilestoneReward } from './endless'
import { fnv1a, mulberry32 } from '@/lib/random'

/** 周 Boss 合成据点固定 id（路由 /battle/weekly_boss） */
export const WEEKLY_BOSS_ID = 'weekly_boss'

/** 周 Boss 可达的最大深度（防御性上限，语义同 MAX_ENDLESS_DEPTH） */
export const MAX_WEEKLY_BOSS_DEPTH = 999

/** Boss 门槛深度：远征解锁初期（best < 6）锁定在此，不再下探 */
export const WEEKLY_BOSS_FLOOR = 6

/**
 * Boss 强度模板轮换表：与 endless 轮换表同源（v0.60 定版四类高难编制），
 * 但独立冻结、互不影响（endless 按 (d-1) mod 4 随深度轮换；
 * 本表按周种子洗牌取 1）。数值导出供测试直测，无其他运行期消费方。
 */
export const WEEKLY_BOSS_TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4'] as const

/**
 * 模板深度偏移（阶段1 校准 2026-09-24 六轮定稿）：把四类编成 50% 墙位的
 * 结构分量对齐——单体巨兽（beast_4，血池集中、50 回合限制下更难）墙位偏早，
 * 步兵海（raider_5）偏晚。卡墙玩家 Boss 胜率落 [15%, 85%] 可过带。
 */
export const WEEKLY_BOSS_OFFSET: Record<(typeof WEEKLY_BOSS_TEMPLATE_IDS)[number], number> = {
  silencer_3: -1,
  raider_5: 1,
  beast_4: -2,
  ruin_4: 2,
}

/** 奖励倍率：≈1.5 场前沿远征单场，周频一次性（校准 §5 量级口径） */
export const WEEKLY_BOSS_REWARD_MULT = 1.5

/** 模板强度归一化系数（endless TEMPLATE_NORMALIZE 同公式，模块加载时算一次） */
const TEMPLATE_NORMALIZE = new Map<string, number>(
  WEEKLY_BOSS_TEMPLATE_IDS.map((id) => {
    const tpl = STRONGHOLDS.find((s) => s.id === id)
    if (!tpl) throw new Error(`weekly-boss: template stronghold missing: ${id}`)
    const power = tpl.enemies.reduce((a, e) => a + (e.attack + e.defense + e.hp) * e.count, 0)
    return [id, power]
  })
)
const BASE_POWER = TEMPLATE_NORMALIZE.get('silencer_3')!

/**
 * 本周 Boss 的模板 id：周标识种子洗牌取 1（同周确定，跨周必换题）。
 * weekKey 为 ISO 周标识（YYYY-Www，调用方传 daily 响应式当前周）。
 */
export function weeklyBossTemplateId(weekKey: string): (typeof WEEKLY_BOSS_TEMPLATE_IDS)[number] {
  const rng = mulberry32(fnv1a('weekly_boss:' + weekKey))
  const pool = [...WEEKLY_BOSS_TEMPLATE_IDS]
  // Fisher-Yates 洗牌后取首（与 ensureWeek 同族；种子含 'weekly_boss:' 域前缀
  // 与挑战池周种子隔离，避免同周联动重掷）
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool[0]!
}

/**
 * Boss 深度：锚玩家终身远征前沿 + 模板偏移，门槛钳制。
 * 小数/负数输入钳制（与 endlessScale 同口径防御）。
 */
export function weeklyBossDepth(expeditionBest: number, templateId: string): number {
  const best = Number.isFinite(expeditionBest) ? Math.max(0, Math.floor(expeditionBest)) : 0
  const offset = WEEKLY_BOSS_OFFSET[templateId as keyof typeof WEEKLY_BOSS_OFFSET] ?? 0
  return Math.min(MAX_WEEKLY_BOSS_DEPTH, Math.max(WEEKLY_BOSS_FLOOR, best + offset))
}

/** 深 d 的奖励：前沿合成据点（best+1 钳门槛）全套 × WEEKLY_BOSS_REWARD_MULT */
export function weeklyBossReward(expeditionBest: number): MilestoneReward {
  const best = Number.isFinite(expeditionBest) ? Math.max(0, Math.floor(expeditionBest)) : 0
  const anchor = endlessStronghold(Math.max(WEEKLY_BOSS_FLOOR, best + 1))
  const out: MilestoneReward = {}
  for (const key of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
    const v = anchor.rewards[key]
    if (v !== undefined) out[key] = Math.round(v * WEEKLY_BOSS_REWARD_MULT)
  }
  return out
}

/**
 * 周 Boss 合成据点（不入 STRONGHOLDS 表；每次调用现算，编辑成本高勿在 tick 调）。
 * 模板缺失抛错（配置错误快速失败，与 endless 同口径）。
 */
export function weeklyBossStronghold(expeditionBest: number, weekKey: string): StrongholdDef {
  const templateId = weeklyBossTemplateId(weekKey)
  const template = STRONGHOLDS.find((s) => s.id === templateId)
  if (!template) throw new Error(`weekly-boss: template stronghold missing: ${templateId}`)
  const normalize = BASE_POWER / TEMPLATE_NORMALIZE.get(templateId)!
  const depth = weeklyBossDepth(expeditionBest, templateId)
  const scale = endlessScale(depth) * normalize
  const enemies = template.enemies.map((e) => {
    const r = (v: number): number => Math.round(v * scale)
    return {
      unitId: e.unitId,
      name: `${t('content.weeklyBoss.prefix')}·${e.name}`,
      attack: r(e.attack),
      defense: r(e.defense),
      hp: r(e.hp),
      count: e.count,
      counteredBy: [...(e.counteredBy ?? [])],
    }
  })
  return {
    id: WEEKLY_BOSS_ID,
    name: t('content.weeklyBoss.name', { d: depth }),
    type: template.type,
    tier: template.tier,
    desc: t('content.weeklyBoss.desc', { d: depth }),
    enemies,
    rewards: weeklyBossReward(expeditionBest),
    idle: {},
  }
}
