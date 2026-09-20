/**
 * tech.ts — 科技树定义
 * 8 大分支：能量学、晶脉学、材料学、计算学、军事学、探索学、暗物质学、奇点学
 */

import { t } from '@/i18n'
import { combatPair, type EffectTypeBase } from '@/lib/effect-types'

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
  type: EffectTypeBase | 'cost_mult' | 'unlock' | 'training_slot'
  target?: string // buildingId | resourceId | unitId | etc
  value: number // 乘数，1.1 = +10%
  label: string
}

export const TECH_BRANCHES: Record<
  TechBranch,
  { id: TechBranch; name: string; color: string; icon: string }
> = {
  energy: {
    id: 'energy',
    name: t('content.tech.branch.energy.name'),
    color: 'var(--color-core)',
    icon: 'i-branch-energy',
  },
  crystallography: {
    id: 'crystallography',
    name: t('content.tech.branch.crystallography.name'),
    color: 'var(--color-quantum)',
    icon: 'i-branch-crystal',
  },
  materials: {
    id: 'materials',
    name: t('content.tech.branch.materials.name'),
    color: 'var(--color-amber)',
    icon: 'i-branch-material',
  },
  computing: {
    id: 'computing',
    name: t('content.tech.branch.computing.name'),
    color: 'var(--color-plasma)',
    icon: 'i-branch-computing',
  },
  military: {
    id: 'military',
    name: t('content.tech.branch.military.name'),
    color: 'var(--color-alert)',
    icon: 'i-branch-military',
  },
  exploration: {
    id: 'exploration',
    name: t('content.tech.branch.exploration.name'),
    color: 'var(--color-layer-void)',
    icon: 'i-branch-explore',
  },
  dark: {
    id: 'dark',
    name: t('content.tech.branch.dark.name'),
    color: 'var(--color-silencer)',
    icon: 'i-branch-dark',
  },
  singularity: {
    id: 'singularity',
    name: t('content.tech.branch.singularity.name'),
    color: 'var(--color-singularity)',
    icon: 'i-branch-singularity',
  },
}

export const TECHS: TechDef[] = [
  // —— 能量学 ——
  {
    id: 'fusion_tech',
    name: t('content.tech.fusion_tech.name'),
    desc: t('content.tech.fusion_tech.desc'),
    branch: 'energy',
    icon: 'i-tech-fusion',
    tier: 1,
    cost: { data: 30, energy: 200 },
    effects: [
      {
        type: 'unlock',
        target: 'fusion_reactor',
        value: 1,
        label: t('content.tech.fusion_tech.effect.0.label'),
      },
    ],
  },
  {
    id: 'energy_eff_1',
    name: t('content.tech.energy_eff_1.name'),
    desc: t('content.tech.energy_eff_1.desc'),
    branch: 'energy',
    icon: 'i-tech-energy-1',
    tier: 2,
    cost: { data: 80, energy: 500 },
    requires: ['fusion_tech'],
    effects: [
      {
        type: 'production_mult',
        target: 'energy',
        value: 1.2,
        label: t('content.tech.energy_eff_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'core_mining',
    name: t('content.tech.core_mining.name'),
    desc: t('content.tech.core_mining.desc'),
    branch: 'energy',
    icon: 'i-tech-core-mine',
    tier: 3,
    cost: { data: 300, energy: 3000 },
    requires: ['energy_eff_1'],
    effects: [
      {
        type: 'unlock',
        target: 'core_extractor',
        value: 1,
        label: t('content.tech.core_mining.effect.0.label'),
      },
    ],
  },
  {
    id: 'energy_eff_2',
    name: t('content.tech.energy_eff_2.name'),
    desc: t('content.tech.energy_eff_2.desc'),
    branch: 'energy',
    icon: 'i-tech-energy-2',
    tier: 4,
    cost: { data: 1200, energy: 15000 },
    requires: ['core_mining'],
    effects: [
      {
        type: 'production_mult',
        target: 'energy',
        value: 1.3,
        label: t('content.tech.energy_eff_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'dyson_theory',
    name: t('content.tech.dyson_theory.name'),
    desc: t('content.tech.dyson_theory.desc'),
    branch: 'energy',
    icon: 'i-tech-dyson',
    tier: 5,
    cost: { data: 5000, energy: 80000, alloy: 2000 },
    requires: ['energy_eff_2'],
    effects: [
      {
        type: 'unlock',
        target: 'dyson_swarm',
        value: 1,
        label: t('content.tech.dyson_theory.effect.0.label'),
      },
    ],
  },

  // —— 晶体学 ——
  {
    id: 'crystal_eff_1',
    name: t('content.tech.crystal_eff_1.name'),
    desc: t('content.tech.crystal_eff_1.desc'),
    branch: 'crystallography',
    icon: 'i-tech-crystal-1',
    tier: 2,
    cost: { data: 100, energy: 500 },
    requires: ['crystal_growth'],
    effects: [
      {
        type: 'production_mult',
        target: 'crystal',
        value: 1.3,
        label: t('content.tech.crystal_eff_1.effect.0.label'),
      },
    ],
  },

  // —— 材料学 ——
  {
    id: 'refine_tech',
    name: t('content.tech.refine_tech.name'),
    desc: t('content.tech.refine_tech.desc'),
    branch: 'materials',
    icon: 'i-tech-refine',
    tier: 1,
    cost: { data: 50, energy: 300 },
    effects: [
      {
        type: 'unlock',
        target: 'refinery',
        value: 1,
        label: t('content.tech.refine_tech.effect.0.label'),
      },
    ],
  },
  {
    id: 'alloy_eff_1',
    name: t('content.tech.alloy_eff_1.name'),
    desc: t('content.tech.alloy_eff_1.desc'),
    branch: 'materials',
    icon: 'i-tech-alloy-1',
    tier: 2,
    cost: { data: 150, energy: 800 },
    requires: ['refine_tech'],
    effects: [
      {
        type: 'production_mult',
        target: 'alloy',
        value: 1.25,
        label: t('content.tech.alloy_eff_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'nano_forge_tech',
    name: t('content.tech.nano_forge_tech.name'),
    desc: t('content.tech.nano_forge_tech.desc'),
    branch: 'materials',
    icon: 'i-tech-nano-forge',
    tier: 2,
    cost: { data: 120, energy: 600, crystal: 80 },
    requires: ['refine_tech'],
    effects: [
      {
        type: 'unlock',
        target: 'nano_forge',
        value: 1,
        label: t('content.tech.nano_forge_tech.effect.0.label'),
      },
    ],
  },
  {
    id: 'ion_casting',
    name: t('content.tech.ion_casting.name'),
    desc: t('content.tech.ion_casting.desc'),
    branch: 'materials',
    icon: 'i-tech-ion-casting',
    tier: 3,
    cost: { data: 800, energy: 6000, alloy: 200 },
    requires: ['nano_forge_tech', 'alloy_eff_1'],
    effects: [
      {
        type: 'unlock',
        target: 'ion_casting_plant',
        value: 1,
        label: t('content.tech.ion_casting.effect.0.label'),
      },
    ],
  },
  {
    id: 'alloy_eff_2',
    name: t('content.tech.alloy_eff_2.name'),
    desc: t('content.tech.alloy_eff_2.desc'),
    branch: 'materials',
    icon: 'i-tech-alloy-2',
    tier: 4,
    cost: { data: 2500, energy: 20000, alloy: 300 },
    requires: ['ion_casting'],
    effects: [
      {
        type: 'production_mult',
        target: 'alloy',
        value: 1.4,
        label: t('content.tech.alloy_eff_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'stellar_forge_theory',
    name: t('content.tech.stellar_forge_theory.name'),
    desc: t('content.tech.stellar_forge_theory.desc'),
    branch: 'materials',
    icon: 'i-tech-stellar-forge',
    tier: 5,
    cost: { data: 8000, energy: 120000, alloy: 5000, dark: 20 },
    requires: ['alloy_eff_2', 'ion_casting'],
    effects: [
      {
        type: 'unlock',
        target: 'stellar_forge',
        value: 1,
        label: t('content.tech.stellar_forge_theory.effect.0.label'),
      },
    ],
  },

  // —— 计算学 ——
  {
    id: 'quantum_tech',
    name: t('content.tech.quantum_tech.name'),
    desc: t('content.tech.quantum_tech.desc'),
    branch: 'computing',
    icon: 'i-tech-quantum',
    tier: 1,
    cost: { data: 200, energy: 2000, alloy: 50 },
    effects: [
      {
        type: 'unlock',
        target: 'quantum_lab',
        value: 1,
        label: t('content.tech.quantum_tech.effect.0.label'),
      },
    ],
  },
  {
    id: 'data_eff_1',
    name: t('content.tech.data_eff_1.name'),
    desc: t('content.tech.data_eff_1.desc'),
    branch: 'computing',
    icon: 'i-tech-data-flow',
    tier: 2,
    cost: { data: 400, energy: 3000 },
    requires: ['quantum_tech'],
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.3,
        label: t('content.tech.data_eff_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'neural_arch',
    name: t('content.tech.neural_arch.name'),
    desc: t('content.tech.neural_arch.desc'),
    branch: 'computing',
    icon: 'i-tech-neural',
    tier: 3,
    cost: { data: 1000, energy: 8000, crystal: 500 },
    requires: ['data_eff_1'],
    effects: [
      {
        type: 'unlock',
        target: 'neural_hub',
        value: 1,
        label: t('content.tech.neural_arch.effect.0.label'),
      },
    ],
  },
  {
    id: 'research_speed',
    name: t('content.tech.research_speed.name'),
    desc: t('content.tech.research_speed.desc'),
    branch: 'computing',
    icon: 'i-tech-research',
    tier: 3,
    cost: { data: 1000, energy: 8000 },
    requires: ['data_eff_1'],
    effects: [
      {
        type: 'cost_mult',
        target: 'tech',
        value: 0.85,
        label: t('content.tech.research_speed.effect.0.label'),
      },
    ],
  },
  {
    id: 'data_eff_2',
    name: t('content.tech.data_eff_2.name'),
    desc: t('content.tech.data_eff_2.desc'),
    branch: 'computing',
    icon: 'i-tech-data-2',
    tier: 4,
    cost: { data: 3000, energy: 25000, alloy: 400 },
    requires: ['neural_arch'],
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.5,
        label: t('content.tech.data_eff_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'holographic_computing',
    name: t('content.tech.holographic_computing.name'),
    desc: t('content.tech.holographic_computing.desc'),
    branch: 'computing',
    icon: 'i-tech-holo',
    tier: 5,
    cost: { data: 10000, energy: 150000, alloy: 3000, dark: 15 },
    requires: ['data_eff_2'],
    effects: [
      {
        type: 'unlock',
        target: 'holographic_core',
        value: 1,
        label: t('content.tech.holographic_computing.effect.0.label'),
      },
    ],
  },

  // —— 军事学 ——
  {
    id: 'military_basic',
    name: t('content.tech.military_basic.name'),
    desc: t('content.tech.military_basic.desc'),
    branch: 'military',
    icon: 'i-tech-mil-basic',
    tier: 1,
    cost: { data: 150, energy: 1000, alloy: 50 },
    effects: [
      {
        type: 'unlock',
        target: 'barracks',
        value: 1,
        label: t('content.tech.military_basic.effect.0.label'),
      },
    ],
  },
  {
    id: 'weapon_upg',
    name: t('content.tech.weapon_upg.name'),
    desc: t('content.tech.weapon_upg.desc'),
    branch: 'military',
    icon: 'i-tech-weapon',
    tier: 2,
    cost: { data: 500, energy: 3000, alloy: 200 },
    requires: ['military_basic'],
    effects: [
      {
        type: 'combat_mult',
        target: 'attack',
        value: 1.2,
        label: t('content.tech.weapon_upg.effect.0.label'),
      },
    ],
  },
  {
    id: 'armor_upg',
    name: t('content.tech.armor_upg.name'),
    desc: t('content.tech.armor_upg.desc'),
    branch: 'military',
    icon: 'i-tech-armor',
    tier: 2,
    cost: { data: 500, energy: 3000, alloy: 200 },
    requires: ['military_basic'],
    effects: [
      {
        type: 'combat_mult',
        target: 'defense',
        value: 1.2,
        label: t('content.tech.armor_upg.effect.0.label'),
      },
    ],
  },
  {
    id: 'adv_units',
    name: t('content.tech.adv_units.name'),
    desc: t('content.tech.adv_units.desc'),
    branch: 'military',
    icon: 'i-tech-adv-units',
    tier: 3,
    cost: { data: 1500, energy: 10000, alloy: 500, dark: 5 },
    requires: ['weapon_upg', 'armor_upg'],
    effects: [
      {
        type: 'unlock',
        target: 'advanced_units',
        value: 1,
        label: t('content.tech.adv_units.effect.0.label'),
      },
    ],
  },
  {
    id: 'parallel_training_1',
    name: t('content.tech.parallel_training_1.name'),
    desc: t('content.tech.parallel_training_1.desc'),
    branch: 'military',
    icon: 'i-tech-mil-drill',
    tier: 3,
    cost: { data: 800, energy: 6000, alloy: 300 },
    requires: ['military_basic'],
    effects: [
      {
        type: 'training_slot',
        value: 1,
        label: t('content.tech.parallel_training_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'parallel_training_2',
    name: t('content.tech.parallel_training_2.name'),
    desc: t('content.tech.parallel_training_2.desc'),
    branch: 'military',
    icon: 'i-tech-mil-basic',
    tier: 4,
    cost: { data: 2500, energy: 20000, alloy: 500 },
    requires: ['parallel_training_1'],
    effects: [
      {
        type: 'training_slot',
        value: 1,
        label: t('content.tech.parallel_training_2.effect.0.label'),
      },
    ],
  },

  // —— 晶脉学 ——
  {
    id: 'crystal_growth',
    name: t('content.tech.crystal_growth.name'),
    desc: t('content.tech.crystal_growth.desc'),
    branch: 'crystallography',
    icon: 'i-tech-crystal-grow',
    tier: 1,
    cost: { data: 60, energy: 400 },
    requires: ['refine_tech'],
    effects: [
      {
        type: 'unlock',
        target: 'crystal_nursery',
        value: 1,
        label: t('content.tech.crystal_growth.effect.0.label'),
      },
    ],
  },
  {
    id: 'deep_crystal_mining',
    name: t('content.tech.deep_crystal_mining.name'),
    desc: t('content.tech.deep_crystal_mining.desc'),
    branch: 'crystallography',
    icon: 'i-tech-deep-mine',
    tier: 3,
    cost: { data: 500, energy: 4000, crystal: 200 },
    requires: ['crystal_eff_1'],
    effects: [
      {
        type: 'unlock',
        target: 'deep_crystal_drill',
        value: 1,
        label: t('content.tech.deep_crystal_mining.effect.0.label'),
      },
    ],
  },
  {
    id: 'crystal_eff_2',
    name: t('content.tech.crystal_eff_2.name'),
    desc: t('content.tech.crystal_eff_2.desc'),
    branch: 'crystallography',
    icon: 'i-tech-crystal-2',
    tier: 4,
    cost: { data: 1500, energy: 18000, crystal: 500 },
    requires: ['deep_crystal_mining'],
    effects: [
      {
        type: 'production_mult',
        target: 'crystal',
        value: 1.4,
        label: t('content.tech.crystal_eff_2.effect.0.label'),
      },
    ],
  },
  {
    id: 'silicon_ring_theory',
    name: t('content.tech.silicon_ring_theory.name'),
    desc: t('content.tech.silicon_ring_theory.desc'),
    branch: 'crystallography',
    icon: 'i-tech-dyson',
    tier: 5,
    cost: { data: 6000, energy: 100000, crystal: 3000, alloy: 1500 },
    requires: ['crystal_eff_2'],
    effects: [
      {
        type: 'unlock',
        target: 'silicon_ring',
        value: 1,
        label: t('content.tech.silicon_ring_theory.effect.0.label'),
      },
    ],
  },

  // —— 探索学 ——
  {
    id: 'explore_basic',
    name: t('content.tech.explore_basic.name'),
    desc: t('content.tech.explore_basic.desc'),
    branch: 'exploration',
    icon: 'i-tech-deep-space',
    tier: 1,
    cost: { data: 100, energy: 800 },
    effects: [],
  },
  {
    id: 'explore_range_1',
    name: t('content.tech.explore_range_1.name'),
    desc: t('content.tech.explore_range_1.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-1',
    tier: 2,
    cost: { data: 400, energy: 4000 },
    requires: ['explore_basic'],
    effects: [
      { type: 'explore_mult', value: 1.3, label: t('content.tech.explore_range_1.effect.0.label') },
    ],
  },
  {
    id: 'explore_range_2',
    name: t('content.tech.explore_range_2.name'),
    desc: t('content.tech.explore_range_2.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-2',
    tier: 3,
    cost: { data: 2000, energy: 15000, alloy: 300 },
    requires: ['explore_range_1'],
    effects: [
      { type: 'explore_mult', value: 1.5, label: t('content.tech.explore_range_2.effect.0.label') },
    ],
  },

  // —— 暗物质学 ——
  {
    id: 'dark_detection',
    name: t('content.tech.dark_detection.name'),
    desc: t('content.tech.dark_detection.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-scan',
    tier: 1,
    cost: { data: 80, energy: 600 },
    requires: ['refine_tech'],
    effects: [
      {
        type: 'unlock',
        target: 'dark_detector',
        value: 1,
        label: t('content.tech.dark_detection.effect.0.label'),
      },
    ],
  },
  {
    id: 'dark_matter_theory',
    name: t('content.tech.dark_matter_theory.name'),
    desc: t('content.tech.dark_matter_theory.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-theory',
    tier: 2,
    cost: { data: 800, energy: 6000, alloy: 500 },
    requires: ['alloy_eff_1'],
    effects: [
      {
        type: 'unlock',
        target: 'dark_matter_lab',
        value: 1,
        label: t('content.tech.dark_matter_theory.effect.0.label'),
      },
    ],
  },
  {
    id: 'dark_capture',
    name: t('content.tech.dark_capture.name'),
    desc: t('content.tech.dark_capture.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-capture',
    tier: 3,
    cost: { data: 3000, energy: 30000, dark: 20 },
    requires: ['dark_matter_theory'],
    effects: [
      {
        type: 'unlock',
        target: 'dark_capture_station',
        value: 1,
        label: t('content.tech.dark_capture.effect.0.label'),
      },
    ],
  },
  {
    id: 'dark_eff_1',
    name: t('content.tech.dark_eff_1.name'),
    desc: t('content.tech.dark_eff_1.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-eff',
    tier: 4,
    cost: { data: 2500, energy: 20000, dark: 10 },
    requires: ['dark_matter_theory'],
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.4,
        label: t('content.tech.dark_eff_1.effect.0.label'),
      },
    ],
  },
  {
    id: 'dark_singularity_well_theory',
    name: t('content.tech.dark_singularity_well_theory.name'),
    desc: t('content.tech.dark_singularity_well_theory.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-well',
    tier: 5,
    cost: { data: 10000, energy: 150000, dark: 50, alloy: 5000 },
    requires: ['dark_capture', 'dark_eff_1'],
    effects: [
      {
        type: 'unlock',
        target: 'dark_singularity_well',
        value: 1,
        label: t('content.tech.dark_singularity_well_theory.effect.0.label'),
      },
    ],
  },
  {
    id: 'singularity_theory',
    name: t('content.tech.singularity_theory.name'),
    desc: t('content.tech.singularity_theory.desc'),
    branch: 'singularity',
    icon: 'i-tech-singularity',
    tier: 1,
    cost: { data: 5000, energy: 50000, dark: 10 },
    requires: ['dyson_theory', 'dark_matter_theory'],
    effects: [],
  },
  {
    id: 'prestige_boost',
    name: t('content.tech.prestige_boost.name'),
    desc: t('content.tech.prestige_boost.desc'),
    branch: 'singularity',
    icon: 'i-tech-prestige',
    tier: 2,
    cost: { data: 20000, energy: 200000, dark: 30 },
    requires: ['singularity_theory'],
    effects: [
      { type: 'prestige_mult', value: 1.5, label: t('content.tech.prestige_boost.effect.0.label') },
    ],
  },
  {
    id: 'offline_enhance',
    name: t('content.tech.offline_enhance.name'),
    desc: t('content.tech.offline_enhance.desc'),
    branch: 'singularity',
    icon: 'i-tech-offline',
    tier: 2,
    cost: { data: 10000, energy: 100000 },
    requires: ['singularity_theory'],
    effects: [
      {
        type: 'offline_bonus',
        value: 1.2,
        label: t('content.tech.offline_enhance.effect.0.label'),
      },
    ],
  },
  // —— 恒星系层配套科技 ——
  {
    id: 'stellar_charting',
    name: t('content.tech.stellar_charting.name'),
    desc: t('content.tech.stellar_charting.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-1',
    tier: 4,
    cost: { data: 8000, energy: 60000, alloy: 1500 },
    requires: ['explore_range_2'],
    effects: [
      {
        type: 'explore_mult',
        value: 1.4,
        label: t('content.tech.stellar_charting.effect.0.label'),
      },
    ],
  },
  {
    id: 'wormhole_stabilization',
    name: t('content.tech.wormhole_stabilization.name'),
    desc: t('content.tech.wormhole_stabilization.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-2',
    tier: 5,
    cost: { data: 20000, energy: 200000, dark: 30 },
    requires: ['stellar_charting'],
    effects: [
      {
        type: 'explore_mult',
        value: 1.5,
        label: t('content.tech.wormhole_stabilization.effect.0.label'),
      },
    ],
  },
  {
    id: 'fleet_logistics',
    name: t('content.tech.fleet_logistics.name'),
    desc: t('content.tech.fleet_logistics.desc'),
    branch: 'military',
    icon: 'i-tech-fleet',
    tier: 5,
    cost: { data: 6000, energy: 50000, alloy: 2000, dark: 10 },
    requires: ['adv_units'],
    effects: combatPair(1.3),
  },
  {
    id: 'dark_resonance',
    name: t('content.tech.dark_resonance.name'),
    desc: t('content.tech.dark_resonance.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-eff',
    tier: 5,
    cost: { data: 15000, energy: 120000, dark: 80 },
    requires: ['dark_singularity_well_theory'],
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.5,
        label: t('content.tech.dark_resonance.effect.0.label'),
      },
    ],
  },
  // —— 星团层配套科技（v0.71）——
  {
    id: 'starcluster_charting',
    name: t('content.tech.starcluster_charting.name'),
    desc: t('content.tech.starcluster_charting.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-2',
    tier: 6,
    cost: { data: 100000, energy: 2000000, dark: 150 },
    requires: ['wormhole_stabilization'],
    effects: [
      {
        type: 'explore_mult',
        value: 1.3,
        label: t('content.tech.starcluster_charting.effect.0.label'),
      },
    ],
  },
  {
    id: 'flagship_doctrine',
    name: t('content.tech.flagship_doctrine.name'),
    desc: t('content.tech.flagship_doctrine.desc'),
    branch: 'military',
    icon: 'i-tech-flagship',
    tier: 6,
    cost: { data: 60000, energy: 1500000, alloy: 50000, dark: 120 },
    requires: ['fleet_logistics'],
    effects: combatPair(1.25),
  },
  {
    id: 'dark_amplifier',
    name: t('content.tech.dark_amplifier.name'),
    desc: t('content.tech.dark_amplifier.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-eff',
    tier: 6,
    cost: { data: 80000, energy: 3000000, dark: 300 },
    requires: ['dark_resonance'],
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.3,
        label: t('content.tech.dark_amplifier.effect.0.label'),
      },
    ],
  },
  {
    id: 'precursor_memory',
    name: t('content.tech.precursor_memory.name'),
    desc: t('content.tech.precursor_memory.desc'),
    branch: 'computing',
    icon: 'i-tech-data-2',
    tier: 6,
    cost: { data: 150000, energy: 2500000, dark: 200 },
    requires: ['singularity_theory'],
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.4,
        label: t('content.tech.precursor_memory.effect.0.label'),
      },
    ],
  },
  // —— 星臂层配套科技（v0.90）——
  {
    id: 'arm_navigation',
    name: t('content.tech.arm_navigation.name'),
    desc: t('content.tech.arm_navigation.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-3',
    tier: 7,
    cost: { data: 1000000, energy: 4000000, dark: 250 },
    requires: ['starcluster_charting'],
    effects: [
      { type: 'explore_mult', value: 1.3, label: t('content.tech.arm_navigation.effect.0.label') },
    ],
  },
  {
    id: 'armada_tactics',
    name: t('content.tech.armada_tactics.name'),
    desc: t('content.tech.armada_tactics.desc'),
    branch: 'military',
    icon: 'i-tech-armada',
    tier: 7,
    cost: { data: 80000, energy: 3000000, alloy: 150000, dark: 220 },
    requires: ['flagship_doctrine'],
    effects: combatPair(1.25),
  },
  {
    id: 'dark_harvester',
    name: t('content.tech.dark_harvester.name'),
    desc: t('content.tech.dark_harvester.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-harvester',
    tier: 7,
    cost: { data: 1200000, energy: 6000000, dark: 400 },
    requires: ['dark_amplifier'],
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.3,
        label: t('content.tech.dark_harvester.effect.0.label'),
      },
    ],
  },
  {
    id: 'neural_archive',
    name: t('content.tech.neural_archive.name'),
    desc: t('content.tech.neural_archive.desc'),
    branch: 'computing',
    icon: 'i-tech-data-3',
    tier: 7,
    cost: { data: 1800000, energy: 5000000, dark: 280 },
    requires: ['precursor_memory'],
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.4,
        label: t('content.tech.neural_archive.effect.0.label'),
      },
    ],
  },
  // —— 星系层配套科技（v0.91）——
  {
    id: 'galaxy_charting',
    name: t('content.tech.galaxy_charting.name'),
    desc: t('content.tech.galaxy_charting.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-4',
    tier: 8,
    cost: { data: 20000000, energy: 100000000, dark: 550 },
    requires: ['arm_navigation'],
    effects: [
      { type: 'explore_mult', value: 1.3, label: t('content.tech.galaxy_charting.effect.0.label') },
    ],
  },
  {
    id: 'galaxy_command',
    name: t('content.tech.galaxy_command.name'),
    desc: t('content.tech.galaxy_command.desc'),
    branch: 'military',
    icon: 'i-tech-galaxy-command',
    tier: 8,
    cost: { data: 1600000, energy: 75000000, alloy: 3500000, dark: 480 },
    requires: ['armada_tactics'],
    effects: combatPair(1.25),
  },
  {
    id: 'dark_web',
    name: t('content.tech.dark_web.name'),
    desc: t('content.tech.dark_web.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-web',
    tier: 8,
    cost: { data: 25000000, energy: 150000000, dark: 900 },
    requires: ['dark_harvester'],
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.3,
        label: t('content.tech.dark_web.effect.0.label'),
      },
    ],
  },
  {
    id: 'galaxy_archive',
    name: t('content.tech.galaxy_archive.name'),
    desc: t('content.tech.galaxy_archive.desc'),
    branch: 'computing',
    icon: 'i-tech-data-4',
    tier: 8,
    cost: { data: 40000000, energy: 120000000, dark: 600 },
    requires: ['neural_archive'],
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.4,
        label: t('content.tech.galaxy_archive.effect.0.label'),
      },
    ],
  },
  // —— 深空层配套科技（v0.92）——
  {
    id: 'void_charting',
    name: t('content.tech.void_charting.name'),
    desc: t('content.tech.void_charting.desc'),
    branch: 'exploration',
    icon: 'i-tech-explore-5',
    tier: 9,
    cost: { data: 50000000, energy: 250000000, dark: 1400 },
    requires: ['galaxy_charting'],
    effects: [
      { type: 'explore_mult', value: 1.3, label: t('content.tech.void_charting.effect.0.label') },
    ],
  },
  {
    id: 'void_command',
    name: t('content.tech.void_command.name'),
    desc: t('content.tech.void_command.desc'),
    branch: 'military',
    icon: 'i-tech-void-command',
    tier: 9,
    cost: { data: 4000000, energy: 190000000, alloy: 8750000, dark: 1200 },
    requires: ['galaxy_command'],
    effects: combatPair(1.25),
  },
  {
    id: 'dark_veil',
    name: t('content.tech.dark_veil.name'),
    desc: t('content.tech.dark_veil.desc'),
    branch: 'dark',
    icon: 'i-tech-dark-veil',
    tier: 9,
    cost: { data: 62500000, energy: 375000000, dark: 2250 },
    requires: ['dark_web'],
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.3,
        label: t('content.tech.dark_veil.effect.0.label'),
      },
    ],
  },
  {
    id: 'void_archive',
    name: t('content.tech.void_archive.name'),
    desc: t('content.tech.void_archive.desc'),
    branch: 'computing',
    icon: 'i-tech-data-5',
    tier: 9,
    cost: { data: 100000000, energy: 300000000, dark: 1500 },
    requires: ['galaxy_archive'],
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.4,
        label: t('content.tech.void_archive.effect.0.label'),
      },
    ],
  },
]

/** 科技查找 Map（O(1) 查找） */
const TECH_MAP = new Map(TECHS.map((t) => [t.id, t]))

export const getTech = (id: string): TechDef | undefined => TECH_MAP.get(id)

/** 判断科技是否可研究（前置已满足且未完成） */
export function techAvailable(def: TechDef, completed: Set<string>): boolean {
  if (completed.has(def.id)) return false
  if (def.requires) {
    for (const r of def.requires) if (!completed.has(r)) return false
  }
  return true
}

/**
 * 按成本乘数换算科技实付成本（向上取整）
 *
 * v0.73 收敛：原 game/useActionQueue/TechView 三处重复循环统一调用本函数。
 * 乘数由调用方传 game.techCostMult（含科技与遗物的 cost_mult/tech 全量聚合）。
 */
export function adjustedTechCost(cost: TechDef['cost'], mult: number): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(cost)) result[k] = Math.ceil(v * mult)
  return result
}
