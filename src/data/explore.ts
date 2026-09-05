/**
 * explore.ts — 探索星图节点定义
 * 星图按距离分 4 层：轨道带、内层系、外层系、深空
 * 探索节点提供一次性奖励 + 解锁据点
 */

export type StarLayer = 'orbit' | 'inner' | 'outer' | 'deep'

export interface ExploreNode {
  id: string
  name: string
  layer: StarLayer
  desc: string
  /** 探索耗时（秒） */
  time: number
  /** 探索成本（一次性） */
  cost: { energy?: number; data?: number; alloy?: number; dark?: number }
  /** 完成奖励 */
  rewards: { energy?: number; crystal?: number; alloy?: number; data?: number; dark?: number }
  /** 前置节点 */
  requires?: string[]
  /** 完成后解锁的据点 id */
  unlocksStronghold?: string[]
  /** 完成后解锁的剧情片段 */
  story?: string
}

export const LAYER_INFO: Record<
  StarLayer,
  { id: StarLayer; name: string; color: string; distance: string }
> = {
  orbit: { id: 'orbit', name: '轨道带', color: '#00E5FF', distance: '0.1-1 AU' },
  inner: { id: 'inner', name: '内层星系', color: '#2EE6A0', distance: '1-50 AU' },
  outer: { id: 'outer', name: '外层星系', color: '#FFB627', distance: '50-5000 AU' },
  deep: { id: 'deep', name: '深空', color: '#A78BFA', distance: '>5000 AU' },
}

export const EXPLORE_NODES: ExploreNode[] = [
  // —— 轨道带 ——
  {
    id: 'node_orbit',
    name: '轨道残骸带',
    layer: 'orbit',
    desc: '环绕母星的碎片带，可能藏有资源与敌人的踪迹',
    time: 30,
    cost: { energy: 100 },
    rewards: { energy: 300, crystal: 10, alloy: 20 },
    unlocksStronghold: ['raider_1'],
    story: '扫描器在轨道残骸带中发现了掠夺者的踪迹。他们似乎在寻找什么……',
  },
  // —— 内层星系 ——
  {
    id: 'node_inner',
    name: '内层行星',
    layer: 'inner',
    desc: '最近的岩石行星，适合建立前哨站',
    time: 120,
    cost: { energy: 1000, data: 50 },
    rewards: { energy: 5000, crystal: 50, alloy: 200, data: 100 },
    requires: ['node_orbit'],
    unlocksStronghold: ['raider_2', 'beast_1'],
    story: '内层行星表面布满了晶体矿脉，但深处传来未知的生物信号。',
  },
  // —— 外层星系 ——
  {
    id: 'node_outer',
    name: '外层气态巨行星',
    layer: 'outer',
    desc: '巨大的气态行星，卫星上可能有遗迹',
    time: 600,
    cost: { energy: 10000, data: 500, alloy: 300 },
    rewards: { energy: 50000, crystal: 200, alloy: 2000, data: 1000, dark: 2 },
    requires: ['node_inner'],
    unlocksStronghold: ['raider_3', 'ruin_1'],
    story: '气态巨行星的卫星上发现了古代遗迹。遗迹深处，一个声音在低语：「他们来了。」',
  },
  // —— 深空 ——
  {
    id: 'node_deep',
    name: '仙女座深空',
    layer: 'deep',
    desc: '通往仙女座的虫洞边缘，终极挑战',
    time: 3600,
    cost: { energy: 100000, data: 5000, alloy: 2000, dark: 5 },
    rewards: { energy: 500000, crystal: 1000, alloy: 10000, data: 10000, dark: 20 },
    requires: ['node_outer'],
    unlocksStronghold: ['beast_2', 'ruin_2', 'silencer_1'],
    story: '虫洞的另一端，沉默者的舰队正在等待。他们的沉默，即将被打破。',
  },
]

/** 探索节点查找 Map（O(1) 查找） */
const NODE_MAP = new Map(EXPLORE_NODES.map((n) => [n.id, n]))

export const getNode = (id: string): ExploreNode | undefined => NODE_MAP.get(id)
