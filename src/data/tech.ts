/**
 * tech.ts — 科技树定义
 * 8 大分支：能量学、晶脉学、材料学、计算学、军事学、探索学、暗物质学、奇点学
 */

export type TechBranch =
  | 'energy'
  | 'crystallography'
  | 'materials'
  | 'computing'
  | 'military'
  | 'exploration'
  | 'dark'
  | 'singularity'

export interface TechDef {
  id: string
  name: string
  desc: string
  branch: TechBranch
  icon: string
  cost: Partial<Record<'data' | 'energy' | 'crystal' | 'alloy' | 'dark', number>>
  /** 解锁前置科技 */
  requires?: string[]
  /** 效果对象：可由效果系统读取 */
  effects: TechEffect[]
  tier: number
}

export interface TechEffect {
  type:
    | 'production_mult'
    | 'cost_mult'
    | 'unlock'
    | 'combat_mult'
    | 'explore_mult'
    | 'prestige_mult'
    | 'offline_bonus'
  target?: string // buildingId | resourceId | unitId | etc
  value: number // 乘数，1.1 = +10%
  label: string
}

export const TECH_BRANCHES: Record<
  TechBranch,
  { id: TechBranch; name: string; color: string; icon: string }
> = {
  energy: { id: 'energy', name: '能量学', color: '#00E5FF', icon: 'i-res-energy' },
  crystallography: {
    id: 'crystallography',
    name: '晶脉学',
    color: '#2EE6A0',
    icon: 'i-branch-crystal',
  },
  materials: { id: 'materials', name: '材料学', color: '#FFB627', icon: 'i-branch-material' },
  computing: { id: 'computing', name: '计算学', color: '#A78BFA', icon: 'i-branch-computing' },
  military: { id: 'military', name: '军事学', color: '#F43F5E', icon: 'i-branch-military' },
  exploration: { id: 'exploration', name: '探索学', color: '#2EE6A0', icon: 'i-branch-explore' },
  dark: { id: 'dark', name: '暗物质学', color: '#94A3B8', icon: 'i-res-dark' },
  singularity: {
    id: 'singularity',
    name: '奇点学',
    color: '#FBBF24',
    icon: 'i-branch-singularity',
  },
}

export const TECHS: TechDef[] = [
  // —— 能量学 ——
  {
    id: 'fusion_tech',
    name: '聚变点火',
    desc: '掌握可控核聚变，解锁聚变反应堆',
    branch: 'energy',
    icon: 'i-bld-reactor',
    tier: 1,
    cost: { data: 30, energy: 200 },
    effects: [{ type: 'unlock', target: 'fusion_reactor', value: 1, label: '解锁聚变反应堆' }],
  },
  {
    id: 'energy_eff_1',
    name: '能效优化 I',
    desc: '所有能量建筑产出 +20%',
    branch: 'energy',
    icon: 'i-res-energy',
    tier: 2,
    cost: { data: 80, energy: 500 },
    requires: ['fusion_tech'],
    effects: [{ type: 'production_mult', target: 'energy', value: 1.2, label: '能量产出 ×1.2' }],
  },
  {
    id: 'core_mining',
    name: '星核采矿',
    desc: '深入行星星核，解锁星核提取器',
    branch: 'energy',
    icon: 'i-res-dark',
    tier: 3,
    cost: { data: 300, energy: 3000 },
    requires: ['energy_eff_1'],
    effects: [{ type: 'unlock', target: 'core_extractor', value: 1, label: '解锁星核提取器' }],
  },
  {
    id: 'energy_eff_2',
    name: '能效优化 II',
    desc: '所有能量建筑产出再 +30%',
    branch: 'energy',
    icon: 'i-tech-energy-2',
    tier: 4,
    cost: { data: 1200, energy: 15000 },
    requires: ['core_mining'],
    effects: [{ type: 'production_mult', target: 'energy', value: 1.3, label: '能量产出 ×1.3' }],
  },
  {
    id: 'dyson_theory',
    name: '戴森球理论',
    desc: '构想恒星级能量收集结构',
    branch: 'energy',
    icon: 'i-tech-dyson',
    tier: 5,
    cost: { data: 5000, energy: 80000, alloy: 2000 },
    requires: ['energy_eff_2'],
    effects: [{ type: 'unlock', target: 'dyson_swarm', value: 1, label: '解锁戴森云' }],
  },

  // —— 晶体学 ——
  {
    id: 'crystal_eff_1',
    name: '晶体工艺',
    desc: '晶体矿场产出 +30%',
    branch: 'crystallography',
    icon: 'i-res-crystal',
    tier: 2,
    cost: { data: 100, energy: 500 },
    requires: ['crystal_growth'],
    effects: [{ type: 'production_mult', target: 'crystal', value: 1.3, label: '晶体产出 ×1.3' }],
  },

  // —— 材料学 ——
  {
    id: 'refine_tech',
    name: '合金精炼',
    desc: '解锁精炼厂，开始生产合金',
    branch: 'materials',
    icon: 'i-tech-refine',
    tier: 1,
    cost: { data: 50, energy: 300 },
    effects: [{ type: 'unlock', target: 'refinery', value: 1, label: '解锁精炼厂' }],
  },
  {
    id: 'alloy_eff_1',
    name: '合金工艺 I',
    desc: '合金建筑产出 +25%',
    branch: 'materials',
    icon: 'i-res-alloy',
    tier: 2,
    cost: { data: 150, energy: 800 },
    requires: ['refine_tech'],
    effects: [{ type: 'production_mult', target: 'alloy', value: 1.25, label: '合金产出 ×1.25' }],
  },
  {
    id: 'nano_forge_tech',
    name: '纳米锻造',
    desc: '掌握纳米级精密锻造技术，解锁纳米锻造厂',
    branch: 'materials',
    icon: 'i-tech-nano-forge',
    tier: 2,
    cost: { data: 120, energy: 600, crystal: 80 },
    requires: ['refine_tech'],
    effects: [{ type: 'unlock', target: 'nano_forge', value: 1, label: '解锁纳米锻造厂' }],
  },
  {
    id: 'ion_casting',
    name: '离子铸造',
    desc: '离子束精铸合金构件，解锁离子铸造站',
    branch: 'materials',
    icon: 'i-tech-ion-casting',
    tier: 3,
    cost: { data: 800, energy: 6000, alloy: 200 },
    requires: ['nano_forge_tech', 'alloy_eff_1'],
    effects: [{ type: 'unlock', target: 'ion_casting_plant', value: 1, label: '解锁离子铸造站' }],
  },
  {
    id: 'alloy_eff_2',
    name: '纳米材料',
    desc: '所有合金建筑产出再 +40%',
    branch: 'materials',
    icon: 'i-tech-alloy-2',
    tier: 4,
    cost: { data: 2500, energy: 20000, alloy: 300 },
    requires: ['ion_casting'],
    effects: [{ type: 'production_mult', target: 'alloy', value: 1.4, label: '合金产出 ×1.4' }],
  },
  {
    id: 'stellar_forge_theory',
    name: '星际熔炉理论',
    desc: '恒星级高温熔炉构想，解锁星际熔炉',
    branch: 'materials',
    icon: 'i-tech-stellar-forge',
    tier: 5,
    cost: { data: 8000, energy: 120000, alloy: 5000, dark: 20 },
    requires: ['alloy_eff_2', 'ion_casting'],
    effects: [{ type: 'unlock', target: 'stellar_forge', value: 1, label: '解锁星际熔炉' }],
  },

  // —— 计算学 ——
  {
    id: 'quantum_tech',
    name: '量子计算',
    desc: '解锁量子实验室，大幅提升数据流',
    branch: 'computing',
    icon: 'i-bld-quantum',
    tier: 1,
    cost: { data: 200, energy: 2000, alloy: 50 },
    effects: [{ type: 'unlock', target: 'quantum_lab', value: 1, label: '解锁量子实验室' }],
  },
  {
    id: 'data_eff_1',
    name: '数据流优化',
    desc: '数据建筑产出 +30%',
    branch: 'computing',
    icon: 'i-res-data',
    tier: 2,
    cost: { data: 400, energy: 3000 },
    requires: ['quantum_tech'],
    effects: [{ type: 'production_mult', target: 'data', value: 1.3, label: '数据产出 ×1.3' }],
  },
  {
    id: 'neural_arch',
    name: '深度学习',
    desc: '深度神经网络架构，解锁神经网络枢纽',
    branch: 'computing',
    icon: 'i-bld-neural-hub',
    tier: 3,
    cost: { data: 1000, energy: 8000, crystal: 500 },
    requires: ['data_eff_1'],
    effects: [{ type: 'unlock', target: 'neural_hub', value: 1, label: '解锁神经网络枢纽' }],
  },
  {
    id: 'research_speed',
    name: '研究加速',
    desc: '所有科技研究成本 -15%',
    branch: 'computing',
    icon: 'i-tech-research',
    tier: 3,
    cost: { data: 1000, energy: 8000 },
    requires: ['data_eff_1'],
    effects: [{ type: 'cost_mult', target: 'tech', value: 0.85, label: '科技成本 ×0.85' }],
  },
  {
    id: 'data_eff_2',
    name: '神经网络',
    desc: '数据建筑产出再 +50%',
    branch: 'computing',
    icon: 'i-tech-data-2',
    tier: 4,
    cost: { data: 3000, energy: 25000, alloy: 400 },
    requires: ['neural_arch'],
    effects: [{ type: 'production_mult', target: 'data', value: 1.5, label: '数据产出 ×1.5' }],
  },
  {
    id: 'holographic_computing',
    name: '全息计算理论',
    desc: '全息态计算引擎构想，解锁全息计算核心',
    branch: 'computing',
    icon: 'i-bld-holo-core',
    tier: 5,
    cost: { data: 10000, energy: 150000, alloy: 3000, dark: 15 },
    requires: ['data_eff_2'],
    effects: [{ type: 'unlock', target: 'holographic_core', value: 1, label: '解锁全息计算核心' }],
  },

  // —— 军事学 ——
  {
    id: 'military_basic',
    name: '军事基础',
    desc: '解锁兵营与基础兵种训练',
    branch: 'military',
    icon: 'i-tech-mil-basic',
    tier: 1,
    cost: { data: 150, energy: 1000, alloy: 50 },
    effects: [{ type: 'unlock', target: 'barracks', value: 1, label: '解锁兵营系统' }],
  },
  {
    id: 'weapon_upg',
    name: '武器升级',
    desc: '所有部队攻击力 +20%',
    branch: 'military',
    icon: 'i-tech-weapon',
    tier: 2,
    cost: { data: 500, energy: 3000, alloy: 200 },
    requires: ['military_basic'],
    effects: [{ type: 'combat_mult', target: 'attack', value: 1.2, label: '部队攻击 ×1.2' }],
  },
  {
    id: 'armor_upg',
    name: '护甲升级',
    desc: '所有部队防御力 +20%',
    branch: 'military',
    icon: 'i-tech-armor',
    tier: 2,
    cost: { data: 500, energy: 3000, alloy: 200 },
    requires: ['military_basic'],
    effects: [{ type: 'combat_mult', target: 'defense', value: 1.2, label: '部队防御 ×1.2' }],
  },
  {
    id: 'adv_units',
    name: '高级兵种',
    desc: '解锁机甲与灵能兵种',
    branch: 'military',
    icon: 'i-nav-army',
    tier: 3,
    cost: { data: 1500, energy: 10000, alloy: 500, dark: 5 },
    requires: ['weapon_upg', 'armor_upg'],
    effects: [{ type: 'unlock', target: 'advanced_units', value: 1, label: '解锁机甲/灵能兵种' }],
  },

  // —— 晶脉学 ——
  {
    id: 'crystal_growth',
    name: '晶格培育',
    desc: '掌握晶格人工培育技术，解锁晶格培育室',
    branch: 'crystallography',
    icon: 'i-tech-crystal-grow',
    tier: 1,
    cost: { data: 60, energy: 400 },
    requires: ['refine_tech'],
    effects: [{ type: 'unlock', target: 'crystal_nursery', value: 1, label: '解锁晶格培育室' }],
  },
  {
    id: 'deep_crystal_mining',
    name: '深晶开采',
    desc: '深入行星地壳开采深层晶体，解锁深晶钻探站',
    branch: 'crystallography',
    icon: 'i-tech-deep-mine',
    tier: 3,
    cost: { data: 500, energy: 4000, crystal: 200 },
    requires: ['crystal_eff_1'],
    effects: [{ type: 'unlock', target: 'deep_crystal_drill', value: 1, label: '解锁深晶钻探站' }],
  },
  {
    id: 'crystal_eff_2',
    name: '晶体工艺 II',
    desc: '所有晶体建筑产出 +40%',
    branch: 'crystallography',
    icon: 'i-tech-crystal-2',
    tier: 4,
    cost: { data: 1500, energy: 18000, crystal: 500 },
    requires: ['deep_crystal_mining'],
    effects: [{ type: 'production_mult', target: 'crystal', value: 1.4, label: '晶体产出 ×1.4' }],
  },
  {
    id: 'silicon_ring_theory',
    name: '硅基星环理论',
    desc: '构想环绕行星的硅基晶体采集环，解锁硅基星环',
    branch: 'crystallography',
    icon: 'i-tech-dyson',
    tier: 5,
    cost: { data: 6000, energy: 100000, crystal: 3000, alloy: 1500 },
    requires: ['crystal_eff_2'],
    effects: [{ type: 'unlock', target: 'silicon_ring', value: 1, label: '解锁硅基星环' }],
  },

  // —— 探索学 ——
  {
    id: 'explore_basic',
    name: '深空探索',
    desc: '解锁星图，可派遣探索队',
    branch: 'exploration',
    icon: 'i-nav-explore',
    tier: 1,
    cost: { data: 100, energy: 800 },
    effects: [{ type: 'unlock', target: 'starmap', value: 1, label: '解锁星图探索' }],
  },
  {
    id: 'explore_range_1',
    name: '探索范围扩展',
    desc: '探索效率 +30%',
    branch: 'exploration',
    icon: 'i-tech-explore-1',
    tier: 2,
    cost: { data: 400, energy: 4000 },
    requires: ['explore_basic'],
    effects: [{ type: 'explore_mult', value: 1.3, label: '探索效率 ×1.3' }],
  },
  {
    id: 'explore_range_2',
    name: '超光速航行',
    desc: '探索效率再 +50%',
    branch: 'exploration',
    icon: 'i-tech-explore-2',
    tier: 3,
    cost: { data: 2000, energy: 15000, alloy: 300 },
    requires: ['explore_range_1'],
    effects: [{ type: 'explore_mult', value: 1.5, label: '探索效率 ×1.5' }],
  },

  // —— 暗物质学 ——
  {
    id: 'dark_detection',
    name: '暗物质探测',
    desc: '探测暗物质微粒痕迹，解锁暗物质探测器',
    branch: 'dark',
    icon: 'i-bld-dark-detector',
    tier: 1,
    cost: { data: 80, energy: 600 },
    requires: ['refine_tech'],
    effects: [{ type: 'unlock', target: 'dark_detector', value: 1, label: '解锁暗物质探测器' }],
  },
  {
    id: 'dark_matter_theory',
    name: '暗物质理论',
    desc: '解锁暗物质实验室',
    branch: 'dark',
    icon: 'i-res-dark',
    tier: 2,
    cost: { data: 800, energy: 6000, alloy: 500 },
    requires: ['alloy_eff_1'],
    effects: [{ type: 'unlock', target: 'dark_matter_lab', value: 1, label: '解锁暗物质实验室' }],
  },
  {
    id: 'dark_capture',
    name: '暗物质捕获',
    desc: '大规模捕获暗物质，解锁暗物质捕获站',
    branch: 'dark',
    icon: 'i-bld-dark-capture',
    tier: 3,
    cost: { data: 3000, energy: 30000, dark: 20 },
    requires: ['dark_matter_theory'],
    effects: [
      { type: 'unlock', target: 'dark_capture_station', value: 1, label: '解锁暗物质捕获站' },
    ],
  },
  {
    id: 'dark_eff_1',
    name: '暗物质增幅',
    desc: '暗物质建筑产出 +40%',
    branch: 'dark',
    icon: 'i-tech-dark-eff',
    tier: 4,
    cost: { data: 2500, energy: 20000, dark: 10 },
    requires: ['dark_matter_theory'],
    effects: [{ type: 'production_mult', target: 'dark', value: 1.4, label: '暗物质产出 ×1.4' }],
  },
  {
    id: 'dark_singularity_well_theory',
    name: '暗物质奇点井',
    desc: '在微型奇点附近汲取暗物质，解锁暗物质奇点井',
    branch: 'dark',
    icon: 'i-bld-dark-well',
    tier: 5,
    cost: { data: 10000, energy: 150000, dark: 50, alloy: 5000 },
    requires: ['dark_capture', 'dark_eff_1'],
    effects: [
      { type: 'unlock', target: 'dark_singularity_well', value: 1, label: '解锁暗物质奇点井' },
    ],
  },
  {
    id: 'singularity_theory',
    name: '奇点理论',
    desc: '理解宇宙奇点，解锁转生',
    branch: 'singularity',
    icon: 'i-nav-prestige',
    tier: 1,
    cost: { data: 5000, energy: 50000, dark: 10 },
    requires: ['dyson_theory', 'dark_matter_theory'],
    effects: [{ type: 'unlock', target: 'prestige', value: 1, label: '解锁奇点重启' }],
  },
  {
    id: 'prestige_boost',
    name: '负熵强化',
    desc: '转生获得的负熵 +50%',
    branch: 'singularity',
    icon: 'i-tech-prestige',
    tier: 2,
    cost: { data: 20000, energy: 200000, dark: 30 },
    requires: ['singularity_theory'],
    effects: [{ type: 'prestige_mult', value: 1.5, label: '负熵获取 ×1.5' }],
  },
  {
    id: 'offline_enhance',
    name: '时间折叠',
    desc: '离线收益 +20%',
    branch: 'singularity',
    icon: 'i-tech-offline',
    tier: 2,
    cost: { data: 10000, energy: 100000 },
    requires: ['singularity_theory'],
    effects: [{ type: 'offline_bonus', value: 1.2, label: '离线收益 ×1.2' }],
  },
]

/** 科技查找 Map（O(1) 查找） */
const TECH_MAP = new Map(TECHS.map((t) => [t.id, t]))

export const getTech = (id: string): TechDef | undefined => TECH_MAP.get(id)

/** 判断科技是否可研究（前置已满足且未完成） */
export function techAvailable(
  def: TechDef,
  completed: Set<string>,
  _unlocked: Set<string>
): boolean {
  if (completed.has(def.id)) return false
  if (def.requires) {
    for (const r of def.requires) if (!completed.has(r)) return false
  }
  return true
}
