/**
 * achievements.ts — 成就/里程碑定义（v0.57 玩法扩展方案 2）
 *
 * 设计口径：
 * - 成就统计基于「终身计数」：转生会重置单轮进度（totals/科技/据点等），
 *   终身计数由 achievements store 在事件钩子处累计，转生不清、hardReset 才清
 * - 遗物/转生次数两类指标读外部现值（遗物与转生进度本身跨转生保留）
 * - 奖励 = 小额永久加成，走 EffectSystem 既有通道；
 *   全拿满的乘数总量刻意压在无限树单个节点几级的量级内（顺路的糖，非第二权力轴）
 * - prestige_mult 仅「欧米茄传承」（集齐 21 遗物）1 个成就给 +10%，封顶无失控风险
 */
/** 成就奖励效果（与转生树/科技/遗物效果同构，走 EffectSystem 聚合） */
export interface AchievementEffect {
  type: 'production_mult' | 'combat_mult' | 'explore_mult' | 'prestige_mult' | 'offline_bonus'
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
  | 'relicsOwned' // 当前遗物持有数（跨转生保留，读现值）
  | 'transcends' // 转生次数（跨转生保留，读现值）
  | 'playtime' // 终身在线秒数

export type AchievementCategory =
  'energy' | 'dark' | 'build' | 'tech' | 'explore' | 'battle' | 'relic' | 'transcend' | 'time'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  category: AchievementCategory
  /** 展示图标（复用 Icons 既有 symbol，不画新图标） */
  icon: string
  metric: AchievementMetric
  threshold: number
  effects: AchievementEffect[]
}

export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, { label: string; icon: string }> =
  {
    energy: { label: '能量里程碑', icon: 'i-res-energy' },
    dark: { label: '暗物质里程碑', icon: 'i-res-dark' },
    build: { label: '建造里程碑', icon: 'i-nav-build' },
    tech: { label: '研究里程碑', icon: 'i-nav-tech' },
    explore: { label: '探索里程碑', icon: 'i-nav-explore' },
    battle: { label: '战斗里程碑', icon: 'i-ui-sword' },
    relic: { label: '遗物收藏', icon: 'i-nav-relic' },
    transcend: { label: '奇点轮回', icon: 'i-nav-prestige' },
    time: { label: '游玩时长', icon: 'i-ui-more' },
  }

function prod(pct: number): AchievementEffect[] {
  return [
    {
      type: 'production_mult',
      target: 'all',
      value: 1 + pct / 100,
      label: `全产出 +${pct}%`,
    },
  ]
}
/** 攻防成对给（与转生树 t_combat_1 同构：attack/defense 各一条） */
function combat(pct: number): AchievementEffect[] {
  return [
    { type: 'combat_mult', target: 'attack', value: 1 + pct / 100, label: `攻击 +${pct}%` },
    { type: 'combat_mult', target: 'defense', value: 1 + pct / 100, label: `防御 +${pct}%` },
  ]
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // —— 能量（终身累计产出）——
  {
    id: 'ach_energy_1',
    name: '星火初燃',
    desc: '累计产出 100,000 能量',
    category: 'energy',
    icon: 'i-res-energy',
    metric: 'energy',
    threshold: 1e5,
    effects: prod(1),
  },
  {
    id: 'ach_energy_2',
    name: '能量狂潮',
    desc: '累计产出 10,000,000 能量',
    category: 'energy',
    icon: 'i-res-energy',
    metric: 'energy',
    threshold: 1e7,
    effects: prod(2),
  },
  {
    id: 'ach_energy_3',
    name: '恒星之海',
    desc: '累计产出 1,000,000,000 能量',
    category: 'energy',
    icon: 'i-res-energy',
    metric: 'energy',
    threshold: 1e9,
    effects: prod(3),
  },
  {
    id: 'ach_energy_4',
    name: '银河熔炉',
    desc: '累计产出 1e12 能量',
    category: 'energy',
    icon: 'i-res-energy',
    metric: 'energy',
    threshold: 1e12,
    effects: prod(5),
  },
  // —— 暗物质（终身累计产出）——
  {
    id: 'ach_dark_1',
    name: '暗流涌动',
    desc: '累计产出 1,000 暗物质',
    category: 'dark',
    icon: 'i-res-dark',
    metric: 'dark',
    threshold: 1e3,
    effects: prod(1),
  },
  {
    id: 'ach_dark_2',
    name: '暗潮澎湃',
    desc: '累计产出 100,000 暗物质',
    category: 'dark',
    icon: 'i-res-dark',
    metric: 'dark',
    threshold: 1e5,
    effects: prod(2),
  },
  {
    id: 'ach_dark_3',
    name: '暗渊之主',
    desc: '累计产出 10,000,000 暗物质',
    category: 'dark',
    icon: 'i-res-dark',
    metric: 'dark',
    threshold: 1e7,
    effects: prod(3),
  },
  // —— 建造 ——
  {
    id: 'ach_build_1',
    name: '奠基者',
    desc: '累计升级建筑 50 次',
    category: 'build',
    icon: 'i-nav-build',
    metric: 'upgrades',
    threshold: 50,
    effects: prod(1),
  },
  {
    id: 'ach_build_2',
    name: '百塔耸立',
    desc: '累计升级建筑 200 次',
    category: 'build',
    icon: 'i-nav-build',
    metric: 'upgrades',
    threshold: 200,
    effects: prod(2),
  },
  {
    id: 'ach_build_3',
    name: '千机互联',
    desc: '累计升级建筑 500 次',
    category: 'build',
    icon: 'i-nav-build',
    metric: 'upgrades',
    threshold: 500,
    effects: prod(2),
  },
  {
    id: 'ach_build_4',
    name: '建筑宗师',
    desc: '任意单座建筑达到 50 级',
    category: 'build',
    icon: 'i-nav-build',
    metric: 'maxBuildingLevel',
    threshold: 50,
    effects: prod(3),
  },
  // —— 研究 ——
  {
    id: 'ach_tech_1',
    name: '科学起步',
    desc: '累计完成 10 项研究',
    category: 'tech',
    icon: 'i-nav-tech',
    metric: 'researches',
    threshold: 10,
    effects: prod(1),
  },
  {
    id: 'ach_tech_2',
    name: '学术传承',
    desc: '累计完成 25 项研究',
    category: 'tech',
    icon: 'i-nav-tech',
    metric: 'researches',
    threshold: 25,
    effects: prod(2),
  },
  {
    id: 'ach_tech_3',
    name: '智慧之巅',
    desc: '累计完成 39 项研究',
    category: 'tech',
    icon: 'i-nav-tech',
    metric: 'researches',
    threshold: 39,
    effects: prod(3),
  },
  // —— 探索 ——
  {
    id: 'ach_explore_1',
    name: '突破轨道',
    desc: '累计完成 4 次探索',
    category: 'explore',
    icon: 'i-nav-explore',
    metric: 'explores',
    threshold: 4,
    effects: [{ type: 'explore_mult', value: 1.1, label: '探索效率 +10%' }],
  },
  {
    id: 'ach_explore_2',
    name: '深空拓者',
    desc: '累计完成 12 次探索',
    category: 'explore',
    icon: 'i-nav-explore',
    metric: 'explores',
    threshold: 12,
    effects: [{ type: 'explore_mult', value: 1.1, label: '探索效率 +10%' }],
  },
  {
    id: 'ach_explore_3',
    name: '星海航行者',
    desc: '累计完成 40 次探索',
    category: 'explore',
    icon: 'i-nav-explore',
    metric: 'explores',
    threshold: 40,
    effects: [{ type: 'explore_mult', value: 1.15, label: '探索效率 +15%' }],
  },
  // —— 战斗 ——
  {
    id: 'ach_battle_1',
    name: '首战告捷',
    desc: '累计攻克 8 个据点',
    category: 'battle',
    icon: 'i-ui-sword',
    metric: 'battles',
    threshold: 8,
    effects: combat(5),
  },
  {
    id: 'ach_battle_2',
    name: '沙场老兵',
    desc: '累计攻克 24 个据点',
    category: 'battle',
    icon: 'i-ui-sword',
    metric: 'battles',
    threshold: 24,
    effects: combat(8),
  },
  {
    id: 'ach_battle_3',
    name: '战争主宰',
    desc: '累计攻克 80 个据点',
    category: 'battle',
    icon: 'i-ui-sword',
    metric: 'battles',
    threshold: 80,
    effects: combat(12),
  },
  // —— 遗物收藏（按当前持有数，遗物跨转生保留）——
  {
    id: 'ach_relic_1',
    name: '收藏新手',
    desc: '持有 5 件遗物',
    category: 'relic',
    icon: 'i-nav-relic',
    metric: 'relicsOwned',
    threshold: 5,
    effects: combat(2),
  },
  {
    id: 'ach_relic_2',
    name: '宝库主人',
    desc: '持有 10 件遗物',
    category: 'relic',
    icon: 'i-nav-relic',
    metric: 'relicsOwned',
    threshold: 10,
    effects: [{ type: 'offline_bonus', value: 1.1, label: '离线收益 +10%' }],
  },
  {
    id: 'ach_relic_3',
    name: '遗物学大家',
    desc: '持有 15 件遗物',
    category: 'relic',
    icon: 'i-nav-relic',
    metric: 'relicsOwned',
    threshold: 15,
    effects: prod(3),
  },
  {
    id: 'ach_relic_4',
    name: '欧米茄传承',
    desc: '集齐全部 21 件遗物',
    category: 'relic',
    icon: 'i-nav-relic',
    metric: 'relicsOwned',
    threshold: 21,
    effects: [{ type: 'prestige_mult', value: 1.1, label: '负熵 +10%' }],
  },
  // —— 转生 ——
  {
    id: 'ach_transcend_1',
    name: '初次奇点',
    desc: '完成 1 次奇点重启',
    category: 'transcend',
    icon: 'i-nav-prestige',
    metric: 'transcends',
    threshold: 1,
    effects: [{ type: 'offline_bonus', value: 1.1, label: '离线收益 +10%' }],
  },
  {
    id: 'ach_transcend_2',
    name: '轮回旅人',
    desc: '完成 3 次奇点重启',
    category: 'transcend',
    icon: 'i-nav-prestige',
    metric: 'transcends',
    threshold: 3,
    effects: prod(2),
  },
  {
    id: 'ach_transcend_3',
    name: '超越大师',
    desc: '完成 5 次奇点重启',
    category: 'transcend',
    icon: 'i-nav-prestige',
    metric: 'transcends',
    threshold: 5,
    effects: [{ type: 'offline_bonus', value: 1.1, label: '离线收益 +10%' }],
  },
  {
    id: 'ach_transcend_4',
    name: '永恒文明',
    desc: '完成 10 次奇点重启',
    category: 'transcend',
    icon: 'i-nav-prestige',
    metric: 'transcends',
    threshold: 10,
    effects: prod(3),
  },
  // —— 游玩时长（终身在线秒数，离线挂机时间不计）——
  {
    id: 'ach_time_1',
    name: '初来乍到',
    desc: '累计在线 1 小时',
    category: 'time',
    icon: 'i-ui-more',
    metric: 'playtime',
    threshold: 3600,
    effects: prod(1),
  },
  {
    id: 'ach_time_2',
    name: '十小时熔炼',
    desc: '累计在线 10 小时',
    category: 'time',
    icon: 'i-ui-more',
    metric: 'playtime',
    threshold: 36000,
    effects: [{ type: 'offline_bonus', value: 1.1, label: '离线收益 +10%' }],
  },
  {
    id: 'ach_time_3',
    name: '五十小时丰碑',
    desc: '累计在线 50 小时',
    category: 'time',
    icon: 'i-ui-more',
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
