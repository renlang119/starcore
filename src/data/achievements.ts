/**
 * achievements.ts — 成就/里程碑定义（v0.57 玩法扩展方案 2）
 *
 * 设计口径：
 * - 成就统计基于「终身计数」：转生会重置单轮进度（totals/科技/据点等），
 *   终身计数由 achievements store 在事件钩子处累计，转生不清、hardReset 才清
 * - 遗物/转生次数两类指标读外部现值（遗物与转生进度本身跨转生保留）
 * - 奖励 = 小额永久加成，走 EffectSystem 既有通道；
 *   全拿满的乘数总量刻意压在无限树单个节点几级的量级内（顺路的糖，非第二权力轴）
 * - prestige_mult 仅「欧米伽传承」（集齐 20 种遗物）1 个成就给 +10%，封顶无失控风险
 */

import { t } from '@/i18n'
import type { EffectTypeBase } from '@/lib/effect-types'

/** 成就奖励效果（与转生树/科技/遗物效果同构，走 EffectSystem 聚合） */
export interface AchievementEffect {
  type: EffectTypeBase
  target?: string
  value: number
  label: string
}

/** 成就统计指标 */
export type AchievementMetric =
  | 'energy' // 终身累计能量产出
  | 'dark' // 终身累计暗物质产出
  | 'upgrades' // 终身建筑升级次数
  | 'maxBuildingLevel' // 终身单建筑最高等级
  | 'researches' // 终身科技研究次数
  | 'explores' // 终身探索完成次数
  | 'battles' // 终身据点攻克次数
  | 'expeditionBest' // 远征历史最深层数（跨转生保留，读现值）
  | 'relicsOwned' // 当前遗物持有数（跨转生保留，读现值）
  | 'relicKinds' // 遗物图鉴种类数（distinct id，不计重复件，读现值）
  | 'transcends' // 转生次数（跨转生保留，读现值）
  | 'playtime' // 终身在线秒数

type AchievementCategory =
  'energy' | 'dark' | 'build' | 'tech' | 'explore' | 'battle' | 'relic' | 'transcend' | 'time'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  category: AchievementCategory
  metric: AchievementMetric
  threshold: number
  effects: AchievementEffect[]
}

export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, { label: string; icon: string }> =
  {
    energy: { label: t('content.achievements.cat.energy.label'), icon: 'i-res-energy' },
    dark: { label: t('content.achievements.cat.dark.label'), icon: 'i-res-dark' },
    build: { label: t('content.achievements.cat.build.label'), icon: 'i-nav-build' },
    tech: { label: t('content.achievements.cat.tech.label'), icon: 'i-nav-tech' },
    explore: { label: t('content.achievements.cat.explore.label'), icon: 'i-nav-explore' },
    battle: { label: t('content.achievements.cat.battle.label'), icon: 'i-ui-sword' },
    relic: { label: t('content.achievements.cat.relic.label'), icon: 'i-nav-relic' },
    transcend: { label: t('content.achievements.cat.transcend.label'), icon: 'i-nav-prestige' },
    time: { label: t('content.achievements.cat.time.label'), icon: 'i-ui-more' },
  }

function prod(pct: number): AchievementEffect[] {
  return [
    {
      type: 'production_mult',
      target: 'all',
      value: 1 + pct / 100,
      label: t('content.achievements.prodLabel', { pct }),
    },
  ]
}
/** 攻防成对给（与转生树 t_combat_1 同构：attack/defense 各一条） */
function combat(pct: number): AchievementEffect[] {
  return [
    {
      type: 'combat_mult',
      target: 'attack',
      value: 1 + pct / 100,
      label: t('content.achievements.combatAttackLabel', { pct }),
    },
    {
      type: 'combat_mult',
      target: 'defense',
      value: 1 + pct / 100,
      label: t('content.achievements.combatDefenseLabel', { pct }),
    },
  ]
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // —— 能量（终身累计产出）——
  {
    id: 'ach_energy_1',
    name: t('content.achievements.ach_energy_1.name'),
    desc: t('content.achievements.ach_energy_1.desc'),
    category: 'energy',
    metric: 'energy',
    threshold: 1e5,
    effects: prod(1),
  },
  {
    id: 'ach_energy_2',
    name: t('content.achievements.ach_energy_2.name'),
    desc: t('content.achievements.ach_energy_2.desc'),
    category: 'energy',
    metric: 'energy',
    threshold: 1e7,
    effects: prod(2),
  },
  {
    id: 'ach_energy_3',
    name: t('content.achievements.ach_energy_3.name'),
    desc: t('content.achievements.ach_energy_3.desc'),
    category: 'energy',
    metric: 'energy',
    threshold: 1e9,
    effects: prod(3),
  },
  {
    id: 'ach_energy_4',
    name: t('content.achievements.ach_energy_4.name'),
    desc: t('content.achievements.ach_energy_4.desc'),
    category: 'energy',
    metric: 'energy',
    threshold: 1e12,
    effects: prod(5),
  },
  // —— 暗物质（终身累计产出）——
  {
    id: 'ach_dark_1',
    name: t('content.achievements.ach_dark_1.name'),
    desc: t('content.achievements.ach_dark_1.desc'),
    category: 'dark',
    metric: 'dark',
    threshold: 1e3,
    effects: prod(1),
  },
  {
    id: 'ach_dark_2',
    name: t('content.achievements.ach_dark_2.name'),
    desc: t('content.achievements.ach_dark_2.desc'),
    category: 'dark',
    metric: 'dark',
    threshold: 1e5,
    effects: prod(2),
  },
  {
    id: 'ach_dark_3',
    name: t('content.achievements.ach_dark_3.name'),
    desc: t('content.achievements.ach_dark_3.desc'),
    category: 'dark',
    metric: 'dark',
    threshold: 1e7,
    effects: prod(3),
  },
  // —— 建造 ——
  {
    id: 'ach_build_1',
    name: t('content.achievements.ach_build_1.name'),
    desc: t('content.achievements.ach_build_1.desc'),
    category: 'build',
    metric: 'upgrades',
    threshold: 50,
    effects: prod(1),
  },
  {
    id: 'ach_build_2',
    name: t('content.achievements.ach_build_2.name'),
    desc: t('content.achievements.ach_build_2.desc'),
    category: 'build',
    metric: 'upgrades',
    threshold: 200,
    effects: prod(2),
  },
  {
    id: 'ach_build_3',
    name: t('content.achievements.ach_build_3.name'),
    desc: t('content.achievements.ach_build_3.desc'),
    category: 'build',
    metric: 'upgrades',
    threshold: 500,
    effects: prod(2),
  },
  {
    id: 'ach_build_4',
    name: t('content.achievements.ach_build_4.name'),
    desc: t('content.achievements.ach_build_4.desc'),
    category: 'build',
    metric: 'maxBuildingLevel',
    threshold: 50,
    effects: prod(3),
  },
  // —— 研究 ——
  {
    id: 'ach_tech_1',
    name: t('content.achievements.ach_tech_1.name'),
    desc: t('content.achievements.ach_tech_1.desc'),
    category: 'tech',
    metric: 'researches',
    threshold: 10,
    effects: prod(1),
  },
  {
    id: 'ach_tech_2',
    name: t('content.achievements.ach_tech_2.name'),
    desc: t('content.achievements.ach_tech_2.desc'),
    category: 'tech',
    metric: 'researches',
    threshold: 25,
    effects: prod(2),
  },
  {
    id: 'ach_tech_3',
    name: t('content.achievements.ach_tech_3.name'),
    desc: t('content.achievements.ach_tech_3.desc'),
    category: 'tech',
    metric: 'researches',
    threshold: 59,
    effects: prod(3),
  },
  // —— 探索 ——
  {
    id: 'ach_explore_1',
    name: t('content.achievements.ach_explore_1.name'),
    desc: t('content.achievements.ach_explore_1.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 4,
    effects: [
      {
        type: 'explore_mult',
        value: 1.1,
        label: t('content.achievements.ach_explore_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_explore_2',
    name: t('content.achievements.ach_explore_2.name'),
    desc: t('content.achievements.ach_explore_2.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 12,
    effects: [
      {
        type: 'explore_mult',
        value: 1.1,
        label: t('content.achievements.ach_explore_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_explore_3',
    name: t('content.achievements.ach_explore_3.name'),
    desc: t('content.achievements.ach_explore_3.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 40,
    effects: [
      {
        type: 'explore_mult',
        value: 1.15,
        label: t('content.achievements.ach_explore_3.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_explore_4',
    name: t('content.achievements.ach_explore_4.name'),
    desc: t('content.achievements.ach_explore_4.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 60,
    effects: [
      {
        type: 'explore_mult',
        value: 1.05,
        label: t('content.achievements.ach_explore_4.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_explore_5',
    name: t('content.achievements.ach_explore_5.name'),
    desc: t('content.achievements.ach_explore_5.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 80,
    effects: [
      {
        type: 'explore_mult',
        value: 1.05,
        label: t('content.achievements.ach_explore_5.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_explore_6',
    name: t('content.achievements.ach_explore_6.name'),
    desc: t('content.achievements.ach_explore_6.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 100,
    effects: [
      {
        type: 'explore_mult',
        value: 1.05,
        label: t('content.achievements.ach_explore_6.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_explore_7',
    name: t('content.achievements.ach_explore_7.name'),
    desc: t('content.achievements.ach_explore_7.desc'),
    category: 'explore',
    metric: 'explores',
    threshold: 120,
    effects: [
      {
        type: 'explore_mult',
        value: 1.05,
        label: t('content.achievements.ach_explore_7.effect.0.label'),
      },
    ],
  },
  // —— 战斗 ——
  {
    id: 'ach_battle_1',
    name: t('content.achievements.ach_battle_1.name'),
    desc: t('content.achievements.ach_battle_1.desc'),
    category: 'battle',
    metric: 'battles',
    threshold: 8,
    effects: combat(5),
  },
  {
    id: 'ach_battle_2',
    name: t('content.achievements.ach_battle_2.name'),
    desc: t('content.achievements.ach_battle_2.desc'),
    category: 'battle',
    metric: 'battles',
    threshold: 24,
    effects: combat(8),
  },
  {
    id: 'ach_battle_3',
    name: t('content.achievements.ach_battle_3.name'),
    desc: t('content.achievements.ach_battle_3.desc'),
    category: 'battle',
    metric: 'battles',
    threshold: 80,
    effects: combat(12),
  },
  // —— 远征深度（读外部现值 expeditionBest，跨转生保留，v0.69）——
  {
    id: 'ach_battle_4',
    name: t('content.achievements.ach_battle_4.name'),
    desc: t('content.achievements.ach_battle_4.desc'),
    category: 'battle',
    metric: 'expeditionBest',
    threshold: 10,
    effects: combat(5),
  },
  {
    id: 'ach_battle_5',
    name: t('content.achievements.ach_battle_5.name'),
    desc: t('content.achievements.ach_battle_5.desc'),
    category: 'battle',
    metric: 'expeditionBest',
    threshold: 20,
    effects: combat(8),
  },
  // —— 遗物收藏（按当前持有数，遗物跨转生保留）——
  {
    id: 'ach_relic_1',
    name: t('content.achievements.ach_relic_1.name'),
    desc: t('content.achievements.ach_relic_1.desc'),
    category: 'relic',
    metric: 'relicsOwned',
    threshold: 5,
    effects: combat(2),
  },
  {
    id: 'ach_relic_2',
    name: t('content.achievements.ach_relic_2.name'),
    desc: t('content.achievements.ach_relic_2.desc'),
    category: 'relic',
    metric: 'relicsOwned',
    threshold: 10,
    effects: [
      {
        type: 'offline_bonus',
        value: 1.1,
        label: t('content.achievements.ach_relic_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_relic_3',
    name: t('content.achievements.ach_relic_3.name'),
    desc: t('content.achievements.ach_relic_3.desc'),
    category: 'relic',
    metric: 'relicsOwned',
    threshold: 15,
    effects: prod(3),
  },
  {
    id: 'ach_relic_4',
    name: t('content.achievements.ach_relic_4.name'),
    desc: t('content.achievements.ach_relic_4.desc'),
    category: 'relic',
    metric: 'relicKinds',
    threshold: 20,
    effects: [
      {
        type: 'prestige_mult',
        value: 1.1,
        label: t('content.achievements.ach_relic_4.effect.0.label'),
      },
    ],
  },
  // —— 转生 ——
  {
    id: 'ach_transcend_1',
    name: t('content.achievements.ach_transcend_1.name'),
    desc: t('content.achievements.ach_transcend_1.desc'),
    category: 'transcend',
    metric: 'transcends',
    threshold: 1,
    effects: [
      {
        type: 'offline_bonus',
        value: 1.1,
        label: t('content.achievements.ach_transcend_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_transcend_2',
    name: t('content.achievements.ach_transcend_2.name'),
    desc: t('content.achievements.ach_transcend_2.desc'),
    category: 'transcend',
    metric: 'transcends',
    threshold: 3,
    effects: prod(2),
  },
  {
    id: 'ach_transcend_3',
    name: t('content.achievements.ach_transcend_3.name'),
    desc: t('content.achievements.ach_transcend_3.desc'),
    category: 'transcend',
    metric: 'transcends',
    threshold: 5,
    effects: [
      {
        type: 'offline_bonus',
        value: 1.1,
        label: t('content.achievements.ach_transcend_3.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_transcend_4',
    name: t('content.achievements.ach_transcend_4.name'),
    desc: t('content.achievements.ach_transcend_4.desc'),
    category: 'transcend',
    metric: 'transcends',
    threshold: 10,
    effects: prod(3),
  },
  // —— 游玩时长（终身在线秒数，离线挂机时间不计）——
  {
    id: 'ach_time_1',
    name: t('content.achievements.ach_time_1.name'),
    desc: t('content.achievements.ach_time_1.desc'),
    category: 'time',
    metric: 'playtime',
    threshold: 3600,
    effects: prod(1),
  },
  {
    id: 'ach_time_2',
    name: t('content.achievements.ach_time_2.name'),
    desc: t('content.achievements.ach_time_2.desc'),
    category: 'time',
    metric: 'playtime',
    threshold: 36000,
    effects: [
      {
        type: 'offline_bonus',
        value: 1.1,
        label: t('content.achievements.ach_time_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'ach_time_3',
    name: t('content.achievements.ach_time_3.name'),
    desc: t('content.achievements.ach_time_3.desc'),
    category: 'time',
    metric: 'playtime',
    threshold: 180000,
    effects: prod(2),
  },
]

export const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id))

/** 按类别分组（保持定义顺序） */
export function groupByCategory(): [AchievementCategory, AchievementDef[]][] {
  const order = Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[]
  return order
    .map((c): [AchievementCategory, AchievementDef[]] => [
      c,
      ACHIEVEMENTS.filter((a) => a.category === c),
    ])
    .filter(([, list]) => list.length > 0)
}
