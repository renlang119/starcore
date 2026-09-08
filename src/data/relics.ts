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
    icon: 'i-relic-armor',
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
    icon: 'i-relic-capsule',
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

/**
 * 套装定义（v0.61 玩法扩展方案 6）
 * 按来源系别分 4 组：同系遗物装备 2 件触发小额加成，3 件（满套）翻倍。
 * 加成走派生 RelicEffect 注入 equippedEffects 通道（EffectSystem 零改动）；
 * 量级刻意压小额——套装是收集方向标，不是第二权力轴。
 */
export type RelicSetId = 'raiders' | 'beast' | 'ruin' | 'silencer'

export interface RelicSetDef {
  id: RelicSetId
  name: string
  /** 一句话主题（UI 套装区块展示） */
  desc: string
  color: string
  /** 套装成员遗物 id（RELIC_POOL 内） */
  memberIds: string[]
  /** 2 件加成 */
  partial: RelicEffect
  /** 3 件（满套）加成 */
  full: RelicEffect
}

export const RELIC_SETS: RelicSetDef[] = [
  {
    id: 'raiders',
    name: '掠夺者战团',
    desc: '从掠夺者残骸中回收的武器技术',
    color: '#F43F5E',
    memberIds: ['r_energy_1', 'r_alloy_1', 'r_combat_1', 'r_combat_2'],
    partial: {
      type: 'combat_mult',
      target: 'attack',
      value: 1.05,
      label: '套装：攻击 +5%（掠夺者战团 2 件）',
    },
    full: {
      type: 'combat_mult',
      target: 'attack',
      value: 1.1,
      label: '满套：攻击 +10%（掠夺者战团）',
    },
  },
  {
    id: 'beast',
    name: '巨兽血裔',
    desc: '异星巨兽躯体内结晶的原始能量',
    color: '#FFB627',
    memberIds: ['r_energy_2', 'r_crystal_2', 'r_energy_3'],
    partial: {
      type: 'production_mult',
      target: 'energy',
      value: 1.06,
      label: '套装：能量产出 +6%（巨兽血裔 2 件）',
    },
    full: {
      type: 'production_mult',
      target: 'energy',
      value: 1.12,
      label: '满套：能量产出 +12%（巨兽血裔）',
    },
  },
  {
    id: 'ruin',
    name: '先驱遗产',
    desc: '先驱文明遗迹中封存的智慧结晶',
    color: '#A78BFA',
    memberIds: [
      'r_data_1',
      'r_crystal_1',
      'r_alloy_2',
      'r_explore_1',
      'r_offline_1',
      'r_data_3',
      'r_prestige_1',
    ],
    partial: {
      type: 'production_mult',
      target: 'data',
      value: 1.06,
      label: '套装：数据产出 +6%（先驱遗产 2 件）',
    },
    full: {
      type: 'production_mult',
      target: 'data',
      value: 1.12,
      label: '满套：数据产出 +12%（先驱遗产）',
    },
  },
  {
    id: 'silencer',
    name: '沉默者回响',
    desc: '沉默者造物中残留的低语',
    color: '#94A3B8',
    memberIds: ['r_dark_1', 'r_dark_2', 'r_dark_3', 'r_combat_3', 'r_omega', 'r_silence'],
    partial: {
      type: 'production_mult',
      target: 'dark',
      value: 1.06,
      label: '套装：暗物质产出 +6%（沉默者回响 2 件）',
    },
    full: {
      type: 'production_mult',
      target: 'dark',
      value: 1.12,
      label: '满套：暗物质产出 +12%（沉默者回响）',
    },
  },
]

/** 遗物 id → 所属套装（O(1) 查找；模块加载时构建一次） */
const RELIC_SET_MAP = new Map<string, RelicSetDef>(
  RELIC_SETS.flatMap((s) => s.memberIds.map((id) => [id, s] as const))
)

/** 查询遗物所属套装 */
export function getSetByRelic(relicId: string): RelicSetDef | undefined {
  return RELIC_SET_MAP.get(relicId)
}

/* ============ 强化等级轴（v0.70） ============ */

/** 强化等级上限（统一封顶，不按稀有度分档） */
export const MAX_RELIC_LEVEL = 20

/**
 * 每级相对增益 g：效果放大公式 1 + (v-1) × (1 + g × Lv)。
 * 主效果 g=0.04（满级 ×1.8）；prestige/cost g=0.01（满级 ×1.2，
 * 与转生树「prestige_mult 不无限化」口径同理，保留稀有强度）。
 */
export const ENHANCE_GAIN: Record<RelicEffect['type'], number> = {
  production_mult: 0.04,
  combat_mult: 0.04,
  explore_mult: 0.04,
  offline_bonus: 0.04,
  prestige_mult: 0.01,
  cost_mult: 0.01,
}

/** 强化成本：cost(Lv) = base × growth^(Lv-1)，base 按稀有度递增 */
export const ENHANCE_COST_BASE: Record<RelicRarity, number> = {
  common: 1e6,
  rare: 5e6,
  epic: 2.5e7,
  legendary: 1.25e8,
}
export const ENHANCE_COST_GROWTH = 1.5

/** 升到 nextLevel（1..MAX_RELIC_LEVEL）所需能量 */
export function enhanceCost(rarity: RelicRarity, nextLevel: number): number {
  return Math.ceil(ENHANCE_COST_BASE[rarity] * Math.pow(ENHANCE_COST_GROWTH, nextLevel - 1))
}

/** 强化后效果值：v → 1 + (v-1) × (1 + g × Lv)（正向放大、折扣加深统一公式） */
export function enhanceValue(value: number, gain: number, level: number): number {
  return 1 + (value - 1) * (1 + gain * level)
}

/** 强化后效果 label：替换原始 label 尾部的「±N%」或「×N」形态 */
export function enhanceLabel(label: string, value: number, gain: number, level: number): string {
  const v = enhanceValue(value, gain, level)
  const pctM = label.match(/^(.+?) ([+-])\s*([\d.]+)%$/)
  if (pctM) {
    const pct = Math.round(Math.abs(v - 1) * 100)
    return `${pctM[1]} ${v >= 1 ? '+' : '-'}${pct}%`
  }
  const multM = label.match(/^(.+?) ×\s*([\d.]+)$/)
  if (multM) {
    const n = Math.round(v * 10) / 10
    return `${multM[1]} ×${n}`
  }
  return label
}
