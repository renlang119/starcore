/**
 * weekly-boss.ts：每周强敌（周 Boss）定义（v1.24 可玩内容扩展方案 5）
 *
 * 每周一（ISO 周，与周期挑战同轨）刷新一只强化据点 Boss：
 * 编成 = 远征 4 模板之一（周种子洗牌取 1，克制考题每周变）
 *        × TEMPLATE_NORMALIZE 强度归一 × endlessScale(bossDepth)；
 * bossDepth = max(6, expeditionBest + OFFSET[模板])，锚玩家终身远征前沿，
 * 模板偏移把四类编成的 50% 墙位结构差对齐（六轮战斗模拟校准定稿，
 * 2026-09-24）。
 *
 * 难度曲线：推进中玩家（墙−4 及以前）Boss 全模板全胜（周津贴）；
 * 卡墙玩家（墙位）胜率落 [15%, 85%]（可过且非白给）；破墙后 Boss 随
 * 前沿上移自校准，永远有下一只。
 *
 * 奖励 = endlessStronghold(max(6, expeditionBest + 1)) 全套 × 1.5，
 * 锚玩家前沿、与模板解耦（消除「难的模板周反而奖金低」错位）；
 * 纯资源包：relicChance/relicRarityBias 不入周 Boss 奖励（与派遣同口径）；
 * 量级 = 1.5 场前沿远征单场，周频一次性，不构成第二资源轴。
 *
 * 帝庭威胁名录（v1.71）：合成据点显示名读剧情条目池（四族 × 8 条，
 * 条目轮换沿既有周种子轨道洗牌取 1，同周同条目），条目名带「每周强敌·」
 * 前缀；条目未命中回退通用键，玩家可见面与 v1.70 行为一致。
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
const MAX_WEEKLY_BOSS_DEPTH = 999

/** Boss 门槛深度：远征解锁初期（best < 6）锁定在此，不再下探 */
export const WEEKLY_BOSS_FLOOR = 6

/**
 * Boss 强度模板轮换表：与 endless 轮换表同源（v0.60 定版四类高难编制），
 * 但独立冻结、互不影响（endless 按 (d-1) mod 4 随深度轮换；
 * 本表按周种子洗牌取 1）。数值导出供测试直测，无其他运行期消费方。
 */
export const WEEKLY_BOSS_TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4'] as const

/**
 * 模板深度偏移（校准 2026-09-24 六轮定稿）：把四类编成 50% 墙位的
 * 结构分量对齐，单体巨兽（beast_4，血池集中、50 回合限制下更难）墙位偏早，
 * 步兵海（raider_5）偏晚。卡墙玩家 Boss 胜率落 [15%, 85%] 可过带。
 */
export const WEEKLY_BOSS_OFFSET: Record<(typeof WEEKLY_BOSS_TEMPLATE_IDS)[number], number> = {
  silencer_3: -1,
  raider_5: 1,
  beast_4: -2,
  ruin_4: 2,
}

/** 奖励倍率：≈1.5 场前沿远征单场，周频一次性（v1.24 校准量级口径） */
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

/** 剧情条目（帝庭威胁名录）：name = 条目名；origin = 出身注（档案口径一行来历） */
export interface WeeklyBossLoreEntry {
  name: string
  origin: string
}

/**
 * 帝庭威胁名录条目池（v1.71）：四模板族各 8 条，zh/en 镜像。
 * 帝庭档案视角统一包装（王庭失格者 / 兽灾 / 先驱遗产 / 不可交涉系），
 * 四族共册；条目文案与数值解耦（只换显示名，编成/深度/奖励零变化）。
 * 数据实体字段口径：模块加载时取词，UI 读字段不做动态键拼接。
 * 导出供测试直测（池结构断言），运行期消费方为 weeklyBossLore。
 */
export const WEEKLY_BOSS_LORE: Record<
  (typeof WEEKLY_BOSS_TEMPLATE_IDS)[number],
  WeeklyBossLoreEntry[]
> = {
  silencer_3: [
    {
      name: t('content.weeklyBoss.lore.silencer.1.name'),
      origin: t('content.weeklyBoss.lore.silencer.1.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.2.name'),
      origin: t('content.weeklyBoss.lore.silencer.2.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.3.name'),
      origin: t('content.weeklyBoss.lore.silencer.3.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.4.name'),
      origin: t('content.weeklyBoss.lore.silencer.4.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.5.name'),
      origin: t('content.weeklyBoss.lore.silencer.5.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.6.name'),
      origin: t('content.weeklyBoss.lore.silencer.6.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.7.name'),
      origin: t('content.weeklyBoss.lore.silencer.7.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.silencer.8.name'),
      origin: t('content.weeklyBoss.lore.silencer.8.origin'),
    },
  ],
  raider_5: [
    {
      name: t('content.weeklyBoss.lore.raider.1.name'),
      origin: t('content.weeklyBoss.lore.raider.1.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.2.name'),
      origin: t('content.weeklyBoss.lore.raider.2.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.3.name'),
      origin: t('content.weeklyBoss.lore.raider.3.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.4.name'),
      origin: t('content.weeklyBoss.lore.raider.4.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.5.name'),
      origin: t('content.weeklyBoss.lore.raider.5.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.6.name'),
      origin: t('content.weeklyBoss.lore.raider.6.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.7.name'),
      origin: t('content.weeklyBoss.lore.raider.7.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.raider.8.name'),
      origin: t('content.weeklyBoss.lore.raider.8.origin'),
    },
  ],
  beast_4: [
    {
      name: t('content.weeklyBoss.lore.beast.1.name'),
      origin: t('content.weeklyBoss.lore.beast.1.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.2.name'),
      origin: t('content.weeklyBoss.lore.beast.2.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.3.name'),
      origin: t('content.weeklyBoss.lore.beast.3.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.4.name'),
      origin: t('content.weeklyBoss.lore.beast.4.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.5.name'),
      origin: t('content.weeklyBoss.lore.beast.5.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.6.name'),
      origin: t('content.weeklyBoss.lore.beast.6.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.7.name'),
      origin: t('content.weeklyBoss.lore.beast.7.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.beast.8.name'),
      origin: t('content.weeklyBoss.lore.beast.8.origin'),
    },
  ],
  ruin_4: [
    {
      name: t('content.weeklyBoss.lore.ruin.1.name'),
      origin: t('content.weeklyBoss.lore.ruin.1.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.2.name'),
      origin: t('content.weeklyBoss.lore.ruin.2.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.3.name'),
      origin: t('content.weeklyBoss.lore.ruin.3.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.4.name'),
      origin: t('content.weeklyBoss.lore.ruin.4.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.5.name'),
      origin: t('content.weeklyBoss.lore.ruin.5.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.6.name'),
      origin: t('content.weeklyBoss.lore.ruin.6.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.7.name'),
      origin: t('content.weeklyBoss.lore.ruin.7.origin'),
    },
    {
      name: t('content.weeklyBoss.lore.ruin.8.name'),
      origin: t('content.weeklyBoss.lore.ruin.8.origin'),
    },
  ],
}

/**
 * 条目轮换纯函数：沿既有周种子轨道（fnv1a('weekly_boss:'+weekKey) 洗牌
 * 取 1，与模板轮换同族口径）——同周同条目；跨周重洗，池深 8 下相邻周
 * 存在 1/8 重合的小概率，观感可接受、加深池自然稀释。空池返回
 * undefined（兜底语义，装配层回退通用键）。导出供测试直测。
 */
export function pickWeeklyBossLore(
  pool: WeeklyBossLoreEntry[],
  weekKey: string
): WeeklyBossLoreEntry | undefined {
  if (pool.length === 0) return undefined
  const arr = [...pool]
  const rng = mulberry32(fnv1a('weekly_boss:' + weekKey))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr[0]
}

/** 本周名录条目：模板族池内按周轮换；未知模板或空池返回 undefined */
export function weeklyBossLore(
  templateId: string,
  weekKey: string
): WeeklyBossLoreEntry | undefined {
  const pool = WEEKLY_BOSS_LORE[templateId as keyof typeof WEEKLY_BOSS_LORE]
  return pool ? pickWeeklyBossLore(pool, weekKey) : undefined
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
  const lore = weeklyBossLore(templateId, weekKey)
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
    // 显示名接剧情条目（v1.71 帝庭威胁名录）：条目名带「每周强敌·」前缀，
    // 与敌方名前缀同口径；池未命中回退通用键
    name: lore
      ? `${t('content.weeklyBoss.prefix')}·${lore.name}`
      : t('content.weeklyBoss.name', { d: depth }),
    type: template.type,
    tier: template.tier,
    desc: lore?.origin ?? t('content.weeklyBoss.desc', { d: depth }),
    enemies,
    rewards: weeklyBossReward(expeditionBest),
    idle: {},
  }
}
