/**
 * buildings.ts — 建筑定义
 * 建筑分布在 5 个扇区：能量扇区、晶体扇区、合金扇区、数据扇区、暗物质扇区
 * 每个建筑有等级、成本增长、产出
 */
import { D } from '@/lib/decimal'

export type ResourceType = 'energy' | 'crystal' | 'alloy' | 'data' | 'dark'
export type SectorId = 'energy' | 'crystal' | 'alloy' | 'data' | 'dark'

export interface BuildingDef {
  id: string
  name: string
  desc: string
  sector: SectorId
  icon: string // svg symbol id
  /** 基础成本 {资源: 数量}，每级按 costGrowth 增长 */
  baseCost: Partial<Record<ResourceType, number>>
  costGrowth: number // 成本增长系数，默认 1.15
  /** 产出 {资源: 每秒} per level */
  produces: Partial<Record<ResourceType, number>>
  /** 解锁条件：前置科技 id */
  requires?: string
  /** 最大等级（0 表示无上限） */
  maxLevel?: number
  /** 等级阶梯（Tier），同一扇区内从 T1 递增 */
  tier: number
}

export const SECTORS: Record<
  SectorId,
  { id: SectorId; name: string; desc: string; color: string }
> = {
  energy: { id: 'energy', name: '能量扇区', desc: '采集星核能量', color: '#00E5FF' },
  crystal: { id: 'crystal', name: '晶体扇区', desc: '开采硅基晶体', color: '#2EE6A0' },
  alloy: { id: 'alloy', name: '合金扇区', desc: '精炼稀有合金', color: '#FFB627' },
  data: { id: 'data', name: '数据扇区', desc: '生成数据流', color: '#A78BFA' },
  dark: { id: 'dark', name: '暗物质扇区', desc: '捕获暗物质粒子', color: '#E84393' },
}

export const BUILDINGS: BuildingDef[] = [
  // —— 能量扇区 ——
  {
    id: 'solar_collector',
    name: '光能收集器',
    desc: '从恒星辐射中采集能量，最基础的能源设施',
    sector: 'energy',
    icon: 'i-res-energy',
    baseCost: { energy: 10 },
    costGrowth: 1.18,
    produces: { energy: 0.5 },
    tier: 1,
  },
  {
    id: 'fusion_reactor',
    name: '聚变反应堆',
    desc: '氘氚聚变提供稳定能量输出',
    sector: 'energy',
    icon: 'i-bld-reactor',
    baseCost: { energy: 200, crystal: 50 },
    costGrowth: 1.15,
    produces: { energy: 4 },
    requires: 'fusion_tech',
    tier: 2,
  },
  {
    id: 'core_extractor',
    name: '星核提取器',
    desc: '直接从行星星核汲取原始能量',
    sector: 'energy',
    icon: 'i-bld-extractor',
    baseCost: { energy: 5000, crystal: 800 },
    costGrowth: 1.13,
    produces: { energy: 35 },
    requires: 'core_mining',
    tier: 3,
  },
  {
    id: 'dyson_swarm',
    name: '戴森云',
    desc: '环绕恒星的能量收集卫星群，产能指数级跃升',
    sector: 'energy',
    icon: 'i-bld-dyson',
    baseCost: { energy: 50000, crystal: 10000, alloy: 1000 },
    costGrowth: 1.1,
    produces: { energy: 300 },
    requires: 'dyson_theory',
    tier: 4,
  },

  // —— 晶体扇区 ——
  {
    id: 'crystal_mine',
    name: '晶体矿场',
    desc: '开采硅基晶体，用于精密建造',
    sector: 'crystal',
    icon: 'i-res-crystal',
    baseCost: { energy: 30 },
    costGrowth: 1.18,
    produces: { crystal: 0.3 },
    tier: 1,
  },
  {
    id: 'crystal_nursery',
    name: '晶格培育室',
    desc: '人工培育晶格结构，加速晶体生成',
    sector: 'crystal',
    icon: 'i-bld-crystal-nursery',
    baseCost: { energy: 250, crystal: 50 },
    costGrowth: 1.15,
    produces: { crystal: 0.9 },
    requires: 'crystal_growth',
    tier: 2,
  },
  {
    id: 'deep_crystal_drill',
    name: '深晶钻探站',
    desc: '深入行星地壳钻探深层晶体矿脉',
    sector: 'crystal',
    icon: 'i-bld-deep-drill',
    baseCost: { energy: 5000, crystal: 1000 },
    costGrowth: 1.13,
    produces: { crystal: 2.0 },
    requires: 'deep_crystal_mining',
    tier: 3,
  },
  {
    id: 'silicon_ring',
    name: '硅基星环',
    desc: '环绕行星的硅基晶体采集环，持续产出高纯晶体',
    sector: 'crystal',
    icon: 'i-bld-silicon-ring',
    baseCost: { energy: 50000, crystal: 10000, alloy: 1000 },
    costGrowth: 1.1,
    produces: { crystal: 15.0 },
    requires: 'silicon_ring_theory',
    tier: 4,
  },
  // —— 合金扇区 ——
  {
    id: 'refinery',
    name: '精炼厂',
    desc: '将粗矿石精炼为可用合金',
    sector: 'alloy',
    icon: 'i-bld-refinery',
    baseCost: { energy: 300, crystal: 60 },
    costGrowth: 1.18,
    produces: { alloy: 0.15 },
    requires: 'refine_tech',
    tier: 1,
  },
  {
    id: 'nano_forge',
    name: '纳米锻造厂',
    desc: '纳米级精密锻造，提升合金产出效率',
    sector: 'alloy',
    icon: 'i-bld-nano-forge',
    baseCost: { energy: 2000, crystal: 400, alloy: 60 },
    costGrowth: 1.15,
    produces: { alloy: 0.3 },
    requires: 'nano_forge_tech',
    tier: 2,
  },
  {
    id: 'ion_casting_plant',
    name: '离子铸造站',
    desc: '离子束精铸高纯度合金构件',
    sector: 'alloy',
    icon: 'i-bld-ion-casting',
    baseCost: { energy: 30000, crystal: 5000, alloy: 1200 },
    costGrowth: 1.13,
    produces: { alloy: 1.2 },
    requires: 'ion_casting',
    tier: 3,
  },
  {
    id: 'stellar_forge',
    name: '星际熔炉',
    desc: '恒星级高温熔炉，锻造暗物质合金',
    sector: 'alloy',
    icon: 'i-bld-stellar-forge',
    baseCost: { energy: 250000, crystal: 50000, alloy: 8000, dark: 10 },
    costGrowth: 1.1,
    produces: { alloy: 5.0 },
    requires: 'stellar_forge_theory',
    tier: 4,
  },
  // —— 暗物质扇区 ——
  {
    id: 'dark_detector',
    name: '暗物质探测器',
    desc: '探测环境中的暗物质微粒痕迹',
    sector: 'dark',
    icon: 'i-bld-dark-detector',
    baseCost: { energy: 2000, crystal: 300, alloy: 50 },
    costGrowth: 1.18,
    produces: { dark: 0.005 },
    requires: 'dark_detection',
    tier: 1,
  },
  {
    id: 'dark_matter_lab',
    name: '暗物质实验室',
    desc: '捕获并稳定暗物质粒子',
    sector: 'dark',
    icon: 'i-bld-lab',
    baseCost: { energy: 8000, alloy: 200 },
    costGrowth: 1.15,
    produces: { dark: 0.02 },
    requires: 'dark_matter_theory',
    tier: 2,
  },
  {
    id: 'dark_capture_station',
    name: '暗物质捕获站',
    desc: '大规模捕获和浓缩暗物质',
    sector: 'dark',
    icon: 'i-bld-dark-capture',
    baseCost: { energy: 80000, alloy: 5000, dark: 20 },
    costGrowth: 1.13,
    produces: { dark: 0.06 },
    requires: 'dark_capture',
    tier: 3,
  },
  {
    id: 'dark_singularity_well',
    name: '暗物质奇点井',
    desc: '在微型奇点附近汲取暗物质',
    sector: 'dark',
    icon: 'i-bld-dark-well',
    baseCost: { energy: 800000, alloy: 30000, dark: 200, crystal: 5000 },
    costGrowth: 1.1,
    produces: { dark: 0.25 },
    requires: 'dark_singularity_well_theory',
    tier: 4,
  },

  // —— 数据扇区 ——
  {
    id: 'data_center',
    name: '数据中心',
    desc: '运算与存储数据流，研究的基础设施',
    sector: 'data',
    icon: 'i-res-data',
    baseCost: { energy: 100, crystal: 20 },
    costGrowth: 1.18,
    produces: { data: 0.2 },
    tier: 1,
  },
  {
    id: 'quantum_lab',
    name: '量子实验室',
    desc: '量子计算加速数据流产出',
    sector: 'data',
    icon: 'i-bld-quantum',
    baseCost: { energy: 5000, alloy: 100, data: 50 },
    costGrowth: 1.15,
    produces: { data: 1.5 },
    requires: 'quantum_tech',
    tier: 2,
  },
  {
    id: 'neural_hub',
    name: '神经网络枢纽',
    desc: '深度神经网络集群，智能数据处理',
    sector: 'data',
    icon: 'i-bld-neural-hub',
    baseCost: { energy: 40000, crystal: 8000, data: 500 },
    costGrowth: 1.13,
    produces: { data: 3.0 },
    requires: 'neural_arch',
    tier: 3,
  },
  {
    id: 'holographic_core',
    name: '全息计算核心',
    desc: '全息态计算引擎，突破经典算力极限',
    sector: 'data',
    icon: 'i-bld-holo-core',
    baseCost: { energy: 300000, alloy: 8000, data: 5000, dark: 15 },
    costGrowth: 1.1,
    produces: { data: 10.0 },
    requires: 'holographic_computing',
    tier: 4,
  },
]

/** 建筑查找 Map（O(1) 查找，替代每次 Array.find 的 O(n) 线性扫描） */
const BUILDING_MAP = new Map(BUILDINGS.map((b) => [b.id, b]))

/** 根据 id 查找建筑定义 */
export const getBuilding = (id: string): BuildingDef | undefined => BUILDING_MAP.get(id)

/** 计算某建筑升到 nextLevel 所需成本 */
export function buildingCost(def: BuildingDef, currentLevel: number): Record<string, number> {
  const result: Record<string, number> = {}
  const factor = D(def.costGrowth).pow(currentLevel)
  for (const [res, base] of Object.entries(def.baseCost)) {
    result[res] = D(base as number)
      .times(factor)
      .ceil()
      .toNumber()
  }
  return result
}
