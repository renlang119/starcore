/**
 * endless.ts — 无尽远征模式定义（v0.60 玩法扩展方案 5）
 *
 * 据点全通后的可重复挑战层：无限深度缩放。
 * 不新增敌方兵种，敌方编成按深度轮换 4 类现役最强模板，克制关系随模板复用；
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

import type { EnemyUnit, StrongholdDef } from './pve'
import { STRONGHOLDS } from './pve'

/**
 * 解锁锚点：本轮攻克沉默者旗舰 silencer_3 后开放远征。
 * 注：silencer_3 已非全表最强据点（v0.71 星团层终章 silencer_4「沉默者母港」强度 592,300 更高），
 * 锚定 silencer_3 为设计意图：远征是通关沉默者旗舰后的长尾入口，与后续更高难度据点解耦，
 * 避免每新增一层据点就被动抬高远征门槛。
 */
export const ENDLESS_UNLOCK_STRONGHOLD = 'silencer_3'

/** 远征合成据点固定 id（路由 /battle/endless） */
export const ENDLESS_STRONGHOLD_ID = 'endless'

/** 无尽远征可达的最大深度（防御性上限，实际受软墙约束远达不到） */
export const MAX_ENDLESS_DEPTH = 999

/** 敌方数值每层成长系数 */
export const ENEMY_GROWTH = 1.25

/** 奖励每层成长系数（刻意大于 ENEMY_GROWTH，越深越值得打） */
export const REWARD_GROWTH = 1.35

/** 深度 d 的敌方数值缩放：D1 = 最强模板 × 0.5 */
export function endlessScale(depth: number): number {
  return 0.5 * Math.pow(ENEMY_GROWTH, depth - 1)
}

/** 深度 d 的奖励缩放：D1 = 沉默者旗舰奖励 × 1.35^0 = 基准 */
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

/** 敌方编成模板：各系现役最强据点编制，按 (深度-1) mod 4 轮换 */
const TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4'] as const

/**
 * 模板强度归一化系数：各模板基础强度差异大（旗舰 >> 巨兽），
 * 按「(攻+防+血)×数量」总强度归一到旗舰基准，保证跨深度难度单调平滑；
 * 模板内部构成差异（单体巨兽 vs 步兵海）保留，只拉平总量。
 * 模块加载时算一次，非逐次计算。
 */
const TEMPLATE_NORMALIZE = new Map<string, number>(
  TEMPLATE_IDS.map((id) => {
    const t = STRONGHOLDS.find((s) => s.id === id)
    const power = t?.enemies.reduce((a, e) => a + (e.attack + e.defense + e.hp) * e.count, 0) ?? 1
    const basePower = STRONGHOLDS.find((s) => s.id === ENDLESS_UNLOCK_STRONGHOLD)!.enemies.reduce(
      (a, e) => a + (e.attack + e.defense + e.hp) * e.count,
      0
    )
    return [id, basePower / power]
  })
)

/** 深度 d 的敌方编成（含「深渊」前缀与深度号命名，模板强度归一化） */
export function endlessEnemies(depth: number): EnemyUnit[] {
  const d = Math.max(1, Math.floor(depth))
  const templateId = TEMPLATE_IDS[(d - 1) % TEMPLATE_IDS.length]
  const template = STRONGHOLDS.find((s) => s.id === templateId)
  if (!template) return []
  const scale = endlessScale(d) * (TEMPLATE_NORMALIZE.get(templateId) ?? 1)
  const prefix = `深渊·第${d}层`
  return scaleEnemies(template.enemies, scale, prefix)
}

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
    name: `无尽深渊·第${d}层`,
    type: 'silencer',
    tier: 6,
    desc: '来自星团深处的未知威胁，越深入，敌影越强，收获也越丰',
    icon: 'i-stronghold-silencer',
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
