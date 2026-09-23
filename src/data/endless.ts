/**
 * endless.ts — 无尽远征模式定义（v0.60 玩法扩展方案 5）
 *
 * 据点全通后的可重复挑战层：无限深度缩放。
 * 不新增敌方兵种，敌方编成按深度轮换 4 类模板，克制关系随模板复用；
 * 敌方数值 = 模板 × endlessScale(d)，奖励 = 沉默者旗舰基准 × endlessRewardScale(d)。
 *
 * 平衡性设计意图（v0.60 方案稿校准，战斗公式忠实移植 + 蒙特洛模拟）：
 * - 敌方成长 1.25/层，奖励成长 1.35/层——奖励刻意快于敌人，越深越值得打；
 * - 刚全通的部队（攻×3 防×2.5）约 D7-D10 进入软墙灰区（保底 1 伤害 + 50 回合超时判负）：
 *   胜负对编队构成敏感，且 4 模板轮换允许 ±1 层抖动（非严格单调），
 *   每轮转生推深 2-4 层，构成「转生 → 练兵 → 推深」的长尾 meta 循环；
 * - E5 软墙原样沿用：敌方数值无限涨而玩家伤害有限时，战斗自然超时判负，
 *   软墙本身就是无限缩放的地狱门，无需额外硬门槛。
 */

import { t } from '@/i18n'
import type { EnemyUnit, StrongholdDef } from './pve'
import { STRONGHOLDS } from './pve'
import type { ResourceType } from './buildings'

/**
 * 解锁锚点：本轮攻克沉默者旗舰 silencer_3 后开放远征。
 * 注：silencer_3 已非全表最强据点（v0.71 星团层终章 silencer_4「沉默者母港」强度 592,300 更高），
 * 锚定 silencer_3 为设计意图：远征是通关沉默者旗舰后的长尾入口，与后续更高难度据点解耦，
 * 避免每新增一层据点就被动抬高远征门槛。
 * （导出供 endless.test.ts 直测，无运行期消费方）
 */
export const ENDLESS_UNLOCK_STRONGHOLD = 'silencer_3'

/** 远征合成据点固定 id（路由 /battle/endless） */
export const ENDLESS_STRONGHOLD_ID = 'endless'

/** 无尽远征可达的最大深度（防御性上限，实际受软墙约束远达不到） */
export const MAX_ENDLESS_DEPTH = 999

/** 敌方数值每层成长系数（导出供 endless.test.ts 直测，无运行期消费方） */
export const ENEMY_GROWTH = 1.25

/** 奖励每层成长系数，刻意大于 ENEMY_GROWTH（导出供 endless.test.ts 直测，无运行期消费方） */
export const REWARD_GROWTH = 1.35

/** 深度 d 的敌方数值缩放：D1 = 最强模板 × 0.5（导出供 endless.test.ts 直测，无运行期消费方） */
export function endlessScale(depth: number): number {
  return 0.5 * Math.pow(ENEMY_GROWTH, depth - 1)
}

/** 深度 d 的奖励缩放：D1 = 基准（导出供 endless.test.ts 直测，无运行期消费方） */
export function endlessRewardScale(depth: number): number {
  return Math.pow(REWARD_GROWTH, depth - 1)
}

/** 远征是否已解锁：本轮须已攻克解锁锚点据点 */
export function endlessUnlocked(completedStrongholds: Set<string>): boolean {
  return completedStrongholds.has(ENDLESS_UNLOCK_STRONGHOLD)
}

/** 克隆并按深度缩放敌方编成 */
function scaleEnemies(enemies: EnemyUnit[], scale: number, prefix: string): EnemyUnit[] {
  const r = (v: number): number => Math.round(v * scale)
  return enemies.map((e) => ({
    ...e,
    name: `${prefix}·${e.name}`,
    attack: r(e.attack),
    defense: r(e.defense),
    hp: r(e.hp),
    count: e.count,
  }))
}

/** 敌方编成模板：v0.60 定版的四类高难度据点编制，按 (深度-1) mod 4 轮换（后续新层不影响轮换表） */
const TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4'] as const

/**
 * 模板强度归一化系数：各模板基础强度差异大（旗舰 >> 巨兽），
 * 按「(攻+防+血)×数量」总强度归一到旗舰基准，保证跨深度难度单调平滑；
 * 模板内部构成差异（单体巨兽 vs 步兵海）保留，只拉平总量。
 * 模块加载时算一次，非逐次计算；任一模板缺失即抛错快速暴露配置错误
 * （静默兜底会让该模板归一化系数退化为基准值，敌人数值被放大数个量级）。
 */
const TEMPLATE_NORMALIZE = new Map<string, number>(
  TEMPLATE_IDS.map((id) => {
    const t = STRONGHOLDS.find((s) => s.id === id)
    if (!t) throw new Error(`endless: template stronghold missing: ${id}`)
    const power = t.enemies.reduce((a, e) => a + (e.attack + e.defense + e.hp) * e.count, 0)
    const basePower = STRONGHOLDS.find((s) => s.id === ENDLESS_UNLOCK_STRONGHOLD)!.enemies.reduce(
      (a, e) => a + (e.attack + e.defense + e.hp) * e.count,
      0
    )
    return [id, basePower / power]
  })
)

/**
 * 深度 d 的敌方编成（含「深渊」前缀与深度号命名，模板强度归一化）。
 * 模板缺失时抛错而不返回空编成：空编成会被战斗结算的空数组遍历
 * 误判为胜利（配置错误快速失败，resolveBattle 另有防御分支兜底）。
 * （导出供 endless.test.ts 直测，无运行期消费方）
 */
export function endlessEnemies(depth: number): EnemyUnit[] {
  const d = Math.max(1, Math.floor(depth))
  const templateId = TEMPLATE_IDS[(d - 1) % TEMPLATE_IDS.length]
  const template = STRONGHOLDS.find((s) => s.id === templateId)
  const normalize = TEMPLATE_NORMALIZE.get(templateId)
  if (!template || normalize === undefined) {
    throw new Error(`endless: template stronghold missing: ${templateId}`)
  }
  const scale = endlessScale(d) * normalize
  const prefix = t('content.endless.prefix', { d })
  return scaleEnemies(template.enemies, scale, prefix)
}

/** 合成据点的 tier 占位（剧情章节标签语义对无尽不适用，UI 侧不展示） */
const ENDLESS_TIER_PLACEHOLDER = 6

/** 远征奖励基准 = 沉默者旗舰（silencer_3）奖励，按深度指数缩放 */
export function endlessStronghold(depth: number): StrongholdDef {
  const d = Math.max(1, Math.floor(depth))
  const base = STRONGHOLDS.find((s) => s.id === ENDLESS_UNLOCK_STRONGHOLD)
  if (!base) throw new Error('endless: reward base stronghold missing')
  const rs = endlessRewardScale(d)
  const scaleReward = (v: number | undefined): number | undefined =>
    v === undefined ? undefined : Math.round(v * rs)
  return {
    id: ENDLESS_STRONGHOLD_ID,
    name: t('content.endless.name', { d }),
    type: 'silencer',
    tier: ENDLESS_TIER_PLACEHOLDER,
    desc: t('content.endless.desc'),
    enemies: endlessEnemies(d),
    rewards: {
      energy: scaleReward(base.rewards.energy),
      crystal: scaleReward(base.rewards.crystal),
      alloy: scaleReward(base.rewards.alloy),
      data: scaleReward(base.rewards.data),
      dark: scaleReward(base.rewards.dark),
      relicChance: Math.min(0.95, 0.5 + 0.05 * d),
      relicRarityBias: Math.min(1, 0.5 + 0.05 * d),
    },
    idle: {},
  }
}

// —— 里程碑奖励（v1.20 可玩内容扩展方案 2）——

/** 里程碑档位步长：每攻克 10 层一档（导出供测试与视图文案直测/直读） */
export const MILESTONE_STEP = 10

/** 里程碑奖励对象：资源键 → 数值（Round 后整数） */
export type MilestoneReward = Partial<Record<ResourceType, number>>

/**
 * 深度到档位的换算：向下取整（best=25 → 2 档，best=9 → 0 档）。
 * 小数/负数输入钳制为非负整数（防御性，与 endlessScale 同口径）。
 */
export function endlessMilestoneTier(depth: number): number {
  if (!Number.isFinite(depth)) return 0
  return Math.max(0, Math.floor(Math.floor(depth) / MILESTONE_STEP))
}

/**
 * 档位奖励 = 深度 10×tier 的合成据点资源奖励（endlessStronghold 同源公式）。
 * 校准依据（v092 战斗模拟分档实测）：档 A 刚通关深空约可推至 D15，
 * 档 B 至 D25，档 C 至 D35 附近，D40 触软墙——每 10 层一档与进度带对齐；
 * 奖励与该深度单场战斗同量级（约为前一整档段累计战斗收入的 27%，
 * 1/(1.35^10-1)），随深度自缩放、档位不封顶。非法档位返回空对象。
 */
export function endlessMilestoneReward(tier: number): Partial<Record<ResourceType, number>> {
  const tierInt = Math.floor(tier)
  if (tierInt < 1 || tierInt !== tier) return {}
  const base = STRONGHOLDS.find((s) => s.id === ENDLESS_UNLOCK_STRONGHOLD)
  if (!base) throw new Error('endless: reward base stronghold missing')
  const rs = endlessRewardScale(tierInt * MILESTONE_STEP)
  const scaleReward = (v: number | undefined): number | undefined =>
    v === undefined ? undefined : Math.round(v * rs)
  const r: Partial<Record<ResourceType, number>> = {}
  for (const key of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
    const v = scaleReward(base.rewards[key])
    if (v !== undefined) r[key] = v
  }
  return r
}

/**
 * 档位是否可领取：深度达标且未在已领清单（补领语义——
 * 更早的未领档位在深度达标后仍可领取，与领取顺序无关）。
 */
export function milestoneClaimable(tier: number, depth: number, claimed: number[]): boolean {
  if (claimed.includes(tier)) return false
  return endlessMilestoneTier(depth) >= tier
}
