/**
 * explore.ts — 探索星图节点定义
 * 星图按距离分 9 层：轨道带、内层星系、外层星系、深空带、恒星系层、星团层、星臂层、星系层、深空层
 * 探索节点提供一次性奖励 + 解锁据点
 */

import { t } from '@/i18n'

export type StarLayer =
  'orbit' | 'inner' | 'outer' | 'deep' | 'stellar' | 'cluster' | 'arm' | 'galaxy' | 'void'

export interface ExploreNode {
  id: string
  name: string
  layer: StarLayer
  desc: string
  /** 探索耗时（秒） */
  time: number
  /** 探索成本（一次性） */
  cost: {
    energy?: number
    data?: number
    alloy?: number
    dark?: number
    crystal?: number
  }
  /** 完成奖励 */
  rewards: { energy?: number; crystal?: number; alloy?: number; data?: number; dark?: number }
  /** 前置节点 */
  requires?: string[]
}

export const LAYER_INFO: Record<
  StarLayer,
  { id: StarLayer; name: string; color: string; distance: string }
> = {
  orbit: {
    id: 'orbit',
    name: t('content.explore.layer.orbit.name'),
    color: 'var(--color-core)',
    distance: '0.1-1 AU',
  },
  inner: {
    id: 'inner',
    name: t('content.explore.layer.inner.name'),
    color: 'var(--color-quantum)',
    distance: '1-50 AU',
  },
  outer: {
    id: 'outer',
    name: t('content.explore.layer.outer.name'),
    color: 'var(--color-amber)',
    distance: '50-5000 AU',
  },
  deep: {
    id: 'deep',
    name: t('content.explore.layer.deep.name'),
    color: 'var(--color-plasma)',
    distance: '>5000 AU',
  },
  stellar: {
    id: 'stellar',
    name: t('content.explore.layer.stellar.name'),
    color: 'var(--color-layer-stellar)',
    distance: '4.2 ly+',
  },
  cluster: {
    id: 'cluster',
    name: t('content.explore.layer.cluster.name'),
    color: 'var(--color-layer-cluster)',
    distance: '>10 kly',
  },
  arm: {
    id: 'arm',
    name: t('content.explore.layer.arm.name'),
    color: 'var(--color-layer-arm)',
    distance: '30-80 kly',
  },
  galaxy: {
    id: 'galaxy',
    name: t('content.explore.layer.galaxy.name'),
    color: 'var(--color-layer-galaxy)',
    distance: '>100 kly',
  },
  void: {
    id: 'void',
    name: t('content.explore.layer.void.name'),
    color: 'var(--color-layer-void)',
    distance: t('content.explore.layer.void.distance'),
  },
}

export const EXPLORE_NODES: ExploreNode[] = [
  // —— 轨道带 ——
  {
    id: 'node_orbit',
    name: t('content.explore.node_orbit.name'),
    layer: 'orbit',
    desc: t('content.explore.node_orbit.desc'),
    time: 30,
    cost: { energy: 100 },
    rewards: { energy: 300, crystal: 10, alloy: 20 },
  },
  // —— 内层星系 ——
  {
    id: 'node_inner',
    name: t('content.explore.node_inner.name'),
    layer: 'inner',
    desc: t('content.explore.node_inner.desc'),
    time: 120,
    cost: { energy: 1000, data: 50 },
    rewards: { energy: 5000, crystal: 50, alloy: 200, data: 100 },
    requires: ['node_orbit'],
  },
  // —— 外层星系 ——
  {
    id: 'node_outer',
    name: t('content.explore.node_outer.name'),
    layer: 'outer',
    desc: t('content.explore.node_outer.desc'),
    time: 600,
    cost: { energy: 10000, data: 500, alloy: 300 },
    rewards: { energy: 50000, crystal: 200, alloy: 2000, data: 1000, dark: 2 },
    requires: ['node_inner'],
  },
  // —— 深空 ——
  {
    id: 'node_deep',
    name: t('content.explore.node_deep.name'),
    layer: 'deep',
    desc: t('content.explore.node_deep.desc'),
    time: 3600,
    cost: { energy: 100000, data: 5000, alloy: 2000, dark: 5 },
    rewards: { energy: 500000, crystal: 1000, alloy: 10000, data: 10000, dark: 20 },
    requires: ['node_outer'],
  },
  // —— 恒星系层 ——
  {
    id: 'node_stellar_gate',
    name: t('content.explore.node_stellar_gate.name'),
    layer: 'stellar',
    desc: t('content.explore.node_stellar_gate.desc'),
    time: 5400,
    cost: { energy: 500000, data: 20000, dark: 15 },
    rewards: { energy: 3000000, crystal: 5000, alloy: 50000, data: 50000, dark: 30 },
    requires: ['node_deep'],
  },
  {
    id: 'node_stellar_mine',
    name: t('content.explore.node_stellar_mine.name'),
    layer: 'stellar',
    desc: t('content.explore.node_stellar_mine.desc'),
    time: 7200,
    cost: { energy: 1500000, crystal: 20000, dark: 20 },
    rewards: { energy: 8000000, crystal: 30000, data: 120000 },
    requires: ['node_stellar_gate'],
  },
  {
    id: 'node_stellar_forge',
    name: t('content.explore.node_stellar_forge.name'),
    layer: 'stellar',
    desc: t('content.explore.node_stellar_forge.desc'),
    time: 7200,
    cost: { energy: 1500000, alloy: 100000, dark: 20 },
    rewards: { energy: 8000000, alloy: 200000, dark: 25 },
    requires: ['node_stellar_gate'],
  },
  {
    id: 'node_stellar_dead',
    name: t('content.explore.node_stellar_dead.name'),
    layer: 'stellar',
    desc: t('content.explore.node_stellar_dead.desc'),
    time: 10800,
    cost: { energy: 4000000, data: 80000, dark: 30 },
    rewards: { energy: 20000000, data: 300000, dark: 40 },
    requires: ['node_stellar_mine', 'node_stellar_forge'],
  },
  {
    id: 'node_stellar_core',
    name: t('content.explore.node_stellar_core.name'),
    layer: 'stellar',
    desc: t('content.explore.node_stellar_core.desc'),
    time: 14400,
    cost: { energy: 10000000, alloy: 500000, dark: 40 },
    rewards: { energy: 50000000, alloy: 1000000, dark: 60 },
    requires: ['node_stellar_dead'],
  },
  {
    id: 'node_stellar_edge',
    name: t('content.explore.node_stellar_edge.name'),
    layer: 'stellar',
    desc: t('content.explore.node_stellar_edge.desc'),
    time: 28800,
    cost: { energy: 50000000, data: 500000, dark: 60 },
    rewards: { energy: 300000000, data: 2000000, dark: 120 },
    requires: ['node_stellar_core'],
  },
  // —— 星团层（v0.71）——
  {
    id: 'node_cluster_gate',
    name: t('content.explore.node_cluster_gate.name'),
    layer: 'cluster',
    desc: t('content.explore.node_cluster_gate.desc'),
    time: 43200,
    cost: { energy: 100000000, data: 200000, dark: 60 },
    rewards: { energy: 600000000, data: 1200000, dark: 120 },
    requires: ['node_stellar_edge'],
  },
  {
    id: 'node_cluster_swarm',
    name: t('content.explore.node_cluster_swarm.name'),
    layer: 'cluster',
    desc: t('content.explore.node_cluster_swarm.desc'),
    time: 57600,
    cost: { energy: 300000000, data: 600000, dark: 90 },
    rewards: { energy: 1500000000, crystal: 300000, data: 3000000, dark: 180 },
    requires: ['node_cluster_gate'],
  },
  {
    id: 'node_cluster_ruin',
    name: t('content.explore.node_cluster_ruin.name'),
    layer: 'cluster',
    desc: t('content.explore.node_cluster_ruin.desc'),
    time: 57600,
    cost: { energy: 300000000, data: 600000, alloy: 200000, dark: 90 },
    rewards: { energy: 1500000000, data: 3000000, alloy: 600000, dark: 180 },
    requires: ['node_cluster_gate'],
  },
  {
    id: 'node_cluster_heart',
    name: t('content.explore.node_cluster_heart.name'),
    layer: 'cluster',
    desc: t('content.explore.node_cluster_heart.desc'),
    time: 72000,
    cost: { energy: 800000000, data: 1500000, dark: 120 },
    rewards: { energy: 4000000000, data: 8000000, crystal: 800000, dark: 240 },
    requires: ['node_cluster_swarm', 'node_cluster_ruin'],
  },
  {
    id: 'node_cluster_hollow',
    name: t('content.explore.node_cluster_hollow.name'),
    layer: 'cluster',
    desc: t('content.explore.node_cluster_hollow.desc'),
    time: 79200,
    cost: { energy: 1500000000, data: 3000000, dark: 160 },
    rewards: { energy: 7500000000, data: 15000000, dark: 320 },
    requires: ['node_cluster_heart'],
  },
  {
    id: 'node_cluster_silence',
    name: t('content.explore.node_cluster_silence.name'),
    layer: 'cluster',
    desc: t('content.explore.node_cluster_silence.desc'),
    time: 86400,
    cost: { energy: 3000000000, data: 6000000, dark: 200 },
    rewards: { energy: 18000000000, data: 40000000, dark: 400 },
    requires: ['node_cluster_hollow'],
  },
  // —— 星臂层（v0.90，敌人编成经战斗模拟脚本三档验证）——
  {
    id: 'node_arm_gate',
    name: t('content.explore.node_arm_gate.name'),
    layer: 'arm',
    desc: t('content.explore.node_arm_gate.desc'),
    time: 86400,
    cost: { energy: 3000000000, data: 6000000, dark: 200 },
    rewards: { energy: 15000000000, data: 12000000, dark: 400 },
    requires: ['node_cluster_silence'],
  },
  {
    id: 'node_arm_cradle',
    name: t('content.explore.node_arm_cradle.name'),
    layer: 'arm',
    desc: t('content.explore.node_arm_cradle.desc'),
    time: 108000,
    cost: { energy: 8000000000, data: 15000000, crystal: 300000, dark: 250 },
    rewards: { energy: 40000000000, crystal: 1500000, data: 3000000, dark: 500 },
    requires: ['node_arm_gate'],
  },
  {
    id: 'node_arm_grave',
    name: t('content.explore.node_arm_grave.name'),
    layer: 'arm',
    desc: t('content.explore.node_arm_grave.desc'),
    time: 108000,
    cost: { energy: 8000000000, data: 15000000, alloy: 500000, dark: 250 },
    rewards: { energy: 40000000000, data: 3000000, alloy: 1500000, dark: 500 },
    requires: ['node_arm_gate'],
  },
  {
    id: 'node_arm_spine',
    name: t('content.explore.node_arm_spine.name'),
    layer: 'arm',
    desc: t('content.explore.node_arm_spine.desc'),
    time: 129600,
    cost: { energy: 20000000000, data: 30000000, dark: 300 },
    rewards: { energy: 100000000000, data: 16000000, crystal: 2000000, dark: 600 },
    requires: ['node_arm_cradle', 'node_arm_grave'],
  },
  {
    id: 'node_arm_abyss',
    name: t('content.explore.node_arm_abyss.name'),
    layer: 'arm',
    desc: t('content.explore.node_arm_abyss.desc'),
    time: 144000,
    cost: { energy: 40000000000, data: 60000000, dark: 350 },
    rewards: { energy: 200000000000, data: 30000000, dark: 800 },
    requires: ['node_arm_spine'],
  },
  {
    id: 'node_arm_threshold',
    name: t('content.explore.node_arm_threshold.name'),
    layer: 'arm',
    desc: t('content.explore.node_arm_threshold.desc'),
    time: 172800,
    cost: { energy: 80000000000, data: 120000000, dark: 450 },
    rewards: { energy: 480000000000, data: 80000000, dark: 1000 },
    requires: ['node_arm_abyss'],
  },
  // —— 星系层（v0.91，敌人编成经战斗模拟脚本三档验证）——
  {
    id: 'node_galaxy_gate',
    name: t('content.explore.node_galaxy_gate.name'),
    layer: 'galaxy',
    desc: t('content.explore.node_galaxy_gate.desc'),
    time: 172800,
    cost: { energy: 80000000000, data: 120000000, dark: 450 },
    rewards: { energy: 400000000000, data: 240000000, dark: 900 },
    requires: ['node_arm_threshold'],
  },
  {
    id: 'node_galaxy_range',
    name: t('content.explore.node_galaxy_range.name'),
    layer: 'galaxy',
    desc: t('content.explore.node_galaxy_range.desc'),
    time: 216000,
    cost: { energy: 200000000000, data: 300000000, crystal: 6000000, dark: 550 },
    rewards: { energy: 1000000000000, data: 60000000, crystal: 30000000, dark: 1100 },
    requires: ['node_galaxy_gate'],
  },
  {
    id: 'node_galaxy_archive',
    name: t('content.explore.node_galaxy_archive.name'),
    layer: 'galaxy',
    desc: t('content.explore.node_galaxy_archive.desc'),
    time: 216000,
    cost: { energy: 200000000000, data: 300000000, alloy: 10000000, dark: 550 },
    rewards: { energy: 1000000000000, data: 60000000, alloy: 30000000, dark: 1100 },
    requires: ['node_galaxy_gate'],
  },
  {
    id: 'node_galaxy_hub',
    name: t('content.explore.node_galaxy_hub.name'),
    layer: 'galaxy',
    desc: t('content.explore.node_galaxy_hub.desc'),
    time: 259200,
    cost: { energy: 500000000000, data: 750000000, dark: 650 },
    rewards: { energy: 2500000000000, data: 400000000, crystal: 40000000, dark: 1400 },
    requires: ['node_galaxy_range', 'node_galaxy_archive'],
  },
  {
    id: 'node_galaxy_halo',
    name: t('content.explore.node_galaxy_halo.name'),
    layer: 'galaxy',
    desc: t('content.explore.node_galaxy_halo.desc'),
    time: 288000,
    cost: { energy: 1000000000000, data: 1500000000, dark: 800 },
    rewards: { energy: 5000000000000, data: 750000000, dark: 1800 },
    requires: ['node_galaxy_hub'],
  },
  {
    id: 'node_galaxy_heart',
    name: t('content.explore.node_galaxy_heart.name'),
    layer: 'galaxy',
    desc: t('content.explore.node_galaxy_heart.desc'),
    time: 345600,
    cost: { energy: 2000000000000, data: 3000000000, dark: 1000 },
    rewards: { energy: 12000000000000, data: 2000000000, dark: 2200 },
    requires: ['node_galaxy_halo'],
  },
  // —— 深空层（v0.92，敌人编成经战斗模拟脚本三档验证）——
  {
    id: 'node_void_gate',
    name: t('content.explore.node_void_gate.name'),
    layer: 'void',
    desc: t('content.explore.node_void_gate.desc'),
    time: 345600,
    cost: { energy: 2000000000000, data: 60000000000, dark: 2900 },
    rewards: { energy: 10000000000000, data: 120000000000, dark: 6400 },
    requires: ['node_galaxy_heart'],
  },
  {
    id: 'node_void_beacon',
    name: t('content.explore.node_void_beacon.name'),
    layer: 'void',
    desc: t('content.explore.node_void_beacon.desc'),
    time: 432000,
    cost: { energy: 5300000000000, data: 160000000000, crystal: 160000000, dark: 3750 },
    rewards: { energy: 26500000000000, data: 320000000000, crystal: 800000000, dark: 8300 },
    requires: ['node_void_gate'],
  },
  {
    id: 'node_void_watch',
    name: t('content.explore.node_void_watch.name'),
    layer: 'void',
    desc: t('content.explore.node_void_watch.desc'),
    time: 432000,
    cost: { energy: 5300000000000, data: 160000000000, alloy: 260000000, dark: 3750 },
    rewards: { energy: 26500000000000, data: 320000000000, alloy: 1300000000, dark: 8300 },
    requires: ['node_void_gate'],
  },
  {
    id: 'node_void_hub',
    name: t('content.explore.node_void_hub.name'),
    layer: 'void',
    desc: t('content.explore.node_void_hub.desc'),
    time: 518400,
    cost: { energy: 13200000000000, data: 400000000000, dark: 4500 },
    rewards: { energy: 66000000000000, data: 800000000000, crystal: 1300000000, dark: 10000 },
    requires: ['node_void_beacon', 'node_void_watch'],
  },
  {
    id: 'node_void_veil',
    name: t('content.explore.node_void_veil.name'),
    layer: 'void',
    desc: t('content.explore.node_void_veil.desc'),
    time: 576000,
    cost: { energy: 26500000000000, data: 800000000000, dark: 5350 },
    rewards: { energy: 132000000000000, data: 1600000000000, dark: 12300 },
    requires: ['node_void_hub'],
  },
  {
    id: 'node_void_origin',
    name: t('content.explore.node_void_origin.name'),
    layer: 'void',
    desc: t('content.explore.node_void_origin.desc'),
    time: 691200,
    cost: { energy: 53000000000000, data: 1600000000000, dark: 6100 },
    rewards: { energy: 265000000000000, data: 3200000000000, dark: 14000 },
    requires: ['node_void_veil'],
  },
]

/** 探索节点查找 Map（O(1) 查找） */
const NODE_MAP = new Map(EXPLORE_NODES.map((n) => [n.id, n]))

export const getNode = (id: string): ExploreNode | undefined => NODE_MAP.get(id)
