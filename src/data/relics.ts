/**
 * relics.ts — 遗物系统定义
 * 4 种稀有度：普通 / 稀有 / 史诗 / 传说
 * 遗物提供永久增益，可装备到遗物槽位
 */

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface RelicEffect {
  type:
    | 'production_mult'
    | 'combat_mult'
    | 'explore_mult'
    | 'prestige_mult'
    | 'cost_mult'
    | 'offline_bonus'
  target?: string
  value: number
  label: string
}

export interface RelicDef {
  id: string
  name: string
  desc: string
  rarity: RelicRarity
  icon: string
  effects: RelicEffect[]
  /** 来源 hint */
  source: string
}

export const RARITY_INFO: Record<
  RelicRarity,
  { id: RelicRarity; name: string; color: string; weight: number; glow: string }
> = {
  common: {
    id: 'common',
    name: '普通',
    color: '#8B96A8',
    weight: 100,
    glow: 'rgba(139,150,168,.3)',
  },
  rare: { id: 'rare', name: '稀有', color: '#00E5FF', weight: 35, glow: 'rgba(0,229,255,.4)' },
  epic: { id: 'epic', name: '史诗', color: '#A78BFA', weight: 10, glow: 'rgba(167,139,250,.5)' },
  legendary: {
    id: 'legendary',
    name: '传说',
    color: '#FFB627',
    weight: 2,
    glow: 'rgba(255,182,39,.6)',
  },
}

export const RELIC_POOL: RelicDef[] = [
  // —— 普通 ——
  {
    id: 'r_energy_1',
    name: '能量碎片',
    desc: '微弱的能量结晶，提升能量产出',
    rarity: 'common',
    icon: 'i-relic-energy-1',
    source: '掠夺者营地',
    effects: [{ type: 'production_mult', target: 'energy', value: 1.05, label: '能量产出 +5%' }],
  },
  {
    id: 'r_alloy_1',
    name: '合金碎屑',
    desc: '精炼残渣中提取的合金片段',
    rarity: 'common',
    icon: 'i-relic-alloy-1',
    source: '掠夺者营地',
    effects: [{ type: 'production_mult', target: 'alloy', value: 1.05, label: '合金产出 +5%' }],
  },
  {
    id: 'r_data_1',
    name: '数据碎片',
    desc: '先驱文明的数据残片',
    rarity: 'common',
    icon: 'i-relic-data-1',
    source: '古代遗迹',
    effects: [{ type: 'production_mult', target: 'data', value: 1.05, label: '数据产出 +5%' }],
  },
  {
    id: 'r_crystal_1',
    name: '晶体碎屑',
    desc: '硅基晶体的天然碎块，轻微提升晶体产出',
    rarity: 'common',
    icon: 'i-relic-crystal-1',
    source: '古代遗迹',
    effects: [{ type: 'production_mult', target: 'crystal', value: 1.05, label: '晶体产出 +5%' }],
  },
  {
    id: 'r_dark_1',
    name: '暗物质微粒',
    desc: '捕获的暗物质微粒残迹，轻微提升暗物质产出',
    rarity: 'common',
    icon: 'i-relic-dark-1',
    source: '沉默者前哨',
    effects: [{ type: 'production_mult', target: 'dark', value: 1.05, label: '暗物质产出 +5%' }],
  },
  {
    id: 'r_combat_1',
    name: '战术手册',
    desc: '基础战术指导，轻微提升战力',
    rarity: 'common',
    icon: 'i-relic-combat-1',
    source: '掠夺者营地',
    effects: [{ type: 'combat_mult', target: 'attack', value: 1.05, label: '攻击力 +5%' }],
  },

  // —— 稀有 ——
  {
    id: 'r_energy_2',
    name: '星核晶簇',
    desc: '浓缩的星核能量结晶',
    rarity: 'rare',
    icon: 'i-relic-energy-2',
    source: '异星巨兽',
    effects: [{ type: 'production_mult', target: 'energy', value: 1.15, label: '能量产出 +15%' }],
  },
  {
    id: 'r_alloy_2',
    name: '纳米合金',
    desc: '可自我修复的智能合金',
    rarity: 'rare',
    icon: 'i-relic-alloy-2',
    source: '古代遗迹',
    effects: [{ type: 'production_mult', target: 'alloy', value: 1.15, label: '合金产出 +15%' }],
  },
  {
    id: 'r_crystal_2',
    name: '纯晶棱镜',
    desc: '高纯度硅基晶体棱镜，显著提升晶体产出',
    rarity: 'rare',
    icon: 'i-relic-crystal-2',
    source: '异星巨兽',
    effects: [{ type: 'production_mult', target: 'crystal', value: 1.15, label: '晶体产出 +15%' }],
  },
  {
    id: 'r_dark_2',
    name: '暗物质凝聚体',
    desc: '稳定凝聚的暗物质团块，显著提升暗物质产出',
    rarity: 'rare',
    icon: 'i-relic-dark-2',
    source: '沉默者前哨',
    effects: [{ type: 'production_mult', target: 'dark', value: 1.15, label: '暗物质产出 +15%' }],
  },
  {
    id: 'r_combat_2',
    name: '强化装甲板',
    desc: '显著增强部队防御',
    rarity: 'rare',
    icon: 'i-relic-combat-1',
    source: '掠夺者据点',
    effects: [{ type: 'combat_mult', target: 'defense', value: 1.15, label: '防御力 +15%' }],
  },
  {
    id: 'r_explore_1',
    name: '星图残页',
    desc: '先驱者绘制的星图片段',
    rarity: 'rare',
    icon: 'i-relic-explore',
    source: '古代遗迹',
    effects: [{ type: 'explore_mult', value: 1.2, label: '探索效率 +20%' }],
  },
  {
    id: 'r_offline_1',
    name: '时间胶囊',
    desc: '稳定时空波动，提升离线收益',
    rarity: 'rare',
    icon: 'i-relic-singularity',
    source: '古代遗迹',
    effects: [{ type: 'offline_bonus', value: 1.1, label: '离线收益 +10%' }],
  },

  // —— 史诗 ——
  {
    id: 'r_energy_3',
    name: '戴森碎片',
    desc: '来自古老戴森球的构件',
    rarity: 'epic',
    icon: 'i-relic-energy-3',
    source: '虚空巨兽',
    effects: [{ type: 'production_mult', target: 'energy', value: 1.4, label: '能量产出 +40%' }],
  },
  {
    id: 'r_data_3',
    name: '量子核心',
    desc: '完整的量子计算核心',
    rarity: 'epic',
    icon: 'i-relic-data-3',
    source: '奇点圣殿',
    effects: [
      { type: 'production_mult', target: 'data', value: 1.4, label: '数据产出 +40%' },
      { type: 'cost_mult', target: 'tech', value: 0.9, label: '科技成本 -10%' },
    ],
  },
  {
    id: 'r_dark_3',
    name: '暗物质奇点',
    desc: '微型暗物质奇点残片，大幅提升暗物质产出',
    rarity: 'epic',
    icon: 'i-relic-dark-3',
    source: '沉默者前哨',
    effects: [{ type: 'production_mult', target: 'dark', value: 1.4, label: '暗物质产出 +40%' }],
  },
  {
    id: 'r_combat_3',
    name: '灵能增幅器',
    desc: '大幅增强灵能单位战力',
    rarity: 'epic',
    icon: 'i-relic-combat-2',
    source: '沉默者前哨',
    effects: [
      { type: 'combat_mult', target: 'attack', value: 1.3, label: '攻击力 +30%' },
      { type: 'combat_mult', target: 'defense', value: 1.2, label: '防御力 +20%' },
    ],
  },
  {
    id: 'r_prestige_1',
    name: '奇点印记',
    desc: '蕴含宇宙奇点的印记',
    rarity: 'epic',
    icon: 'i-relic-singularity',
    source: '奇点圣殿',
    effects: [{ type: 'prestige_mult', value: 1.5, label: '转生负熵 +50%' }],
  },

  // —— 传说 ——
  {
    id: 'r_omega',
    name: '欧米伽协议',
    desc: '先驱文明留下的终极指令，全面提升一切产能',
    rarity: 'legendary',
    icon: 'i-relic-omega',
    source: '沉默者前哨',
    effects: [
      { type: 'production_mult', target: 'energy', value: 1.5, label: '能量产出 +50%' },
      { type: 'production_mult', target: 'alloy', value: 1.5, label: '合金产出 +50%' },
      { type: 'production_mult', target: 'data', value: 1.5, label: '数据产出 +50%' },
      { type: 'combat_mult', target: 'attack', value: 1.4, label: '攻击力 +40%' },
    ],
  },
  {
    id: 'r_silence',
    name: '沉默者之眼',
    desc: '来自沉默者的神秘造物，赋予超越常理的力量',
    rarity: 'legendary',
    icon: 'i-relic-silence',
    source: '沉默者前哨',
    effects: [
      { type: 'production_mult', target: 'all', value: 1.3, label: '全资源产出 +30%' },
      { type: 'prestige_mult', value: 2.0, label: '转生负熵 ×2' },
    ],
  },
]

/**
 * 根据 rarityBias 抽取一个遗物（rarityBias 越高越偏向高稀有度）
 *
 * 设计意图：允许重复掉落
 * 玩家可拥有多件相同 id 的遗物（每件有唯一 instanceId），
 * 可同时装备以叠加效果。这是放置类游戏常见设计，鼓励反复刷据点。
 * 如需"同类遗物不叠加"，需在 `relics.obtain()` 中增加去重逻辑。
 */
export function rollRelic(rarityBias = 0, rng: () => number = Math.random): RelicDef {
  const bias = Math.max(0, Math.min(1, rarityBias))
  const rarities: RelicRarity[] = ['common', 'rare', 'epic', 'legendary']
  const weights = rarities.map((r) => {
    const base = RARITY_INFO[r].weight
    const idx = rarities.indexOf(r)
    // bias 越高，高稀有度权重越大
    return base * (1 + bias * idx * 1.5)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng() * total
  let chosen: RelicRarity = 'common'
  for (let i = 0; i < rarities.length; i++) {
    roll -= weights[i]
    if (roll <= 0) {
      chosen = rarities[i]
      break
    }
  }
  const pool = RELIC_POOL.filter((r) => r.rarity === chosen)
  if (pool.length > 0) {
    return pool[Math.floor(rng() * pool.length)]
  }
  // 降级处理：目标稀有度池为空，逐级降低稀有度查找
  const rarityOrder: RelicRarity[] = ['legendary', 'epic', 'rare', 'common']
  const startIdx = rarityOrder.indexOf(chosen)
  for (let i = startIdx + 1; i < rarityOrder.length; i++) {
    const fallbackPool = RELIC_POOL.filter((r) => r.rarity === rarityOrder[i])
    if (fallbackPool.length > 0) {
      return fallbackPool[Math.floor(rng() * fallbackPool.length)]
    }
  }
  // 兜底：返回 RELIC_POOL[0]（确保不返回 undefined）
  return RELIC_POOL[0]
}

/** 按 id 从 RELIC_POOL 查找遗物定义 */
export function getRelicById(id: string): RelicDef | undefined {
  return RELIC_POOL.find((r) => r.id === id)
}
