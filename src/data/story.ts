/**
 * story.ts — 探索节点剧情文案
 *
 * 34 条节点叙事片段（v1.08 自 explore.ts 迁出的世界观资产）；
 * 由 ArchiveView 星图档案按节点 id 回读；键 = 探索节点 id。
 */

import { t } from '@/i18n'

/** 节点 id → 剧情文案 */
export const NODE_STORIES: Record<string, string> = {
  node_orbit: t('content.story.node_orbit'),
  node_inner: t('content.story.node_inner'),
  node_outer: t('content.story.node_outer'),
  node_deep: t('content.story.node_deep'),
  node_stellar_gate: t('content.story.node_stellar_gate'),
  node_stellar_mine: t('content.story.node_stellar_mine'),
  node_stellar_forge: t('content.story.node_stellar_forge'),
  node_stellar_dead: t('content.story.node_stellar_dead'),
  node_stellar_core: t('content.story.node_stellar_core'),
  node_stellar_edge: t('content.story.node_stellar_edge'),
  node_cluster_gate: t('content.story.node_cluster_gate'),
  node_cluster_swarm: t('content.story.node_cluster_swarm'),
  node_cluster_ruin: t('content.story.node_cluster_ruin'),
  node_cluster_heart: t('content.story.node_cluster_heart'),
  node_cluster_hollow: t('content.story.node_cluster_hollow'),
  node_cluster_silence: t('content.story.node_cluster_silence'),
  node_arm_gate: t('content.story.node_arm_gate'),
  node_arm_cradle: t('content.story.node_arm_cradle'),
  node_arm_grave: t('content.story.node_arm_grave'),
  node_arm_spine: t('content.story.node_arm_spine'),
  node_arm_abyss: t('content.story.node_arm_abyss'),
  node_arm_threshold: t('content.story.node_arm_threshold'),
  node_galaxy_gate: t('content.story.node_galaxy_gate'),
  node_galaxy_range: t('content.story.node_galaxy_range'),
  node_galaxy_archive: t('content.story.node_galaxy_archive'),
  node_galaxy_hub: t('content.story.node_galaxy_hub'),
  node_galaxy_halo: t('content.story.node_galaxy_halo'),
  node_galaxy_heart: t('content.story.node_galaxy_heart'),
  node_void_gate: t('content.story.node_void_gate'),
  node_void_beacon: t('content.story.node_void_beacon'),
  node_void_watch: t('content.story.node_void_watch'),
  node_void_hub: t('content.story.node_void_hub'),
  node_void_veil: t('content.story.node_void_veil'),
  node_void_origin: t('content.story.node_void_origin'),
}
