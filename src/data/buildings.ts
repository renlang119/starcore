/**
 * buildings.ts — 建筑定义
 * 建筑分布在 5 个扇区：能量扇区、晶体扇区、合金扇区、数据扇区、暗物质扇区
 * 每个建筑有等级、成本增长、产出
 */
import { t } from '@/i18n'
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
  costGrowth: number // 成本增长系数（数据表逐条显式声明）
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
  energy: {
    id: 'energy',
    name: t('content.buildings.sector.energy.name'),
    desc: t('content.buildings.sector.energy.desc'),
    color: 'var(--color-core)',
  },
  crystal: {
    id: 'crystal',
    name: t('content.buildings.sector.crystal.name'),
    desc: t('content.buildings.sector.crystal.desc'),
    color: 'var(--color-quantum)',
  },
  alloy: {
    id: 'alloy',
    name: t('content.buildings.sector.alloy.name'),
    desc: t('content.buildings.sector.alloy.desc'),
    color: 'var(--color-amber)',
  },
  data: {
    id: 'data',
    name: t('content.buildings.sector.data.name'),
    desc: t('content.buildings.sector.data.desc'),
    color: 'var(--color-plasma)',
  },
  dark: {
    id: 'dark',
    name: t('content.buildings.sector.dark.name'),
    desc: t('content.buildings.sector.dark.desc'),
    color: 'var(--color-sector-dark)',
  },
}

export const BUILDINGS: BuildingDef[] = [
  // —— 能量扇区 ——
  {
    id: 'solar_collector',
    name: t('content.buildings.solar_collector.name'),
    desc: t('content.buildings.solar_collector.desc'),
    sector: 'energy',
    icon: 'i-res-energy',
    baseCost: { energy: 10 },
    costGrowth: 1.18,
    produces: { energy: 0.5 },
    tier: 1,
  },
  {
    id: 'fusion_reactor',
    name: t('content.buildings.fusion_reactor.name'),
    desc: t('content.buildings.fusion_reactor.desc'),
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
    name: t('content.buildings.core_extractor.name'),
    desc: t('content.buildings.core_extractor.desc'),
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
    name: t('content.buildings.dyson_swarm.name'),
    desc: t('content.buildings.dyson_swarm.desc'),
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
    name: t('content.buildings.crystal_mine.name'),
    desc: t('content.buildings.crystal_mine.desc'),
    sector: 'crystal',
    icon: 'i-res-crystal',
    baseCost: { energy: 30 },
    costGrowth: 1.18,
    produces: { crystal: 0.3 },
    tier: 1,
  },
  {
    id: 'crystal_nursery',
    name: t('content.buildings.crystal_nursery.name'),
    desc: t('content.buildings.crystal_nursery.desc'),
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
    name: t('content.buildings.deep_crystal_drill.name'),
    desc: t('content.buildings.deep_crystal_drill.desc'),
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
    name: t('content.buildings.silicon_ring.name'),
    desc: t('content.buildings.silicon_ring.desc'),
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
    name: t('content.buildings.refinery.name'),
    desc: t('content.buildings.refinery.desc'),
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
    name: t('content.buildings.nano_forge.name'),
    desc: t('content.buildings.nano_forge.desc'),
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
    name: t('content.buildings.ion_casting_plant.name'),
    desc: t('content.buildings.ion_casting_plant.desc'),
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
    name: t('content.buildings.stellar_forge.name'),
    desc: t('content.buildings.stellar_forge.desc'),
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
    name: t('content.buildings.dark_detector.name'),
    desc: t('content.buildings.dark_detector.desc'),
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
    name: t('content.buildings.dark_matter_lab.name'),
    desc: t('content.buildings.dark_matter_lab.desc'),
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
    name: t('content.buildings.dark_capture_station.name'),
    desc: t('content.buildings.dark_capture_station.desc'),
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
    name: t('content.buildings.dark_singularity_well.name'),
    desc: t('content.buildings.dark_singularity_well.desc'),
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
    name: t('content.buildings.data_center.name'),
    desc: t('content.buildings.data_center.desc'),
    sector: 'data',
    icon: 'i-res-data',
    baseCost: { energy: 100, crystal: 20 },
    costGrowth: 1.18,
    produces: { data: 0.2 },
    tier: 1,
  },
  {
    id: 'quantum_lab',
    name: t('content.buildings.quantum_lab.name'),
    desc: t('content.buildings.quantum_lab.desc'),
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
    name: t('content.buildings.neural_hub.name'),
    desc: t('content.buildings.neural_hub.desc'),
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
    name: t('content.buildings.holographic_core.name'),
    desc: t('content.buildings.holographic_core.desc'),
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
