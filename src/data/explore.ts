/**
 * explore.ts — 探索星图节点定义
 * 星图按距离分 5 层：轨道带、内层系、外层系、深空、恒星系层
 * 探索节点提供一次性奖励 + 解锁据点
 */

export type StarLayer = 'orbit' | 'inner' | 'outer' | 'deep' | 'stellar'

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
  stellar: { id: 'stellar', name: '恒星系层', color: '#E879F9', distance: '4.2 ly+' },
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
  // —— 恒星系层 ——
  {
    id: 'node_stellar_gate',
    name: '半人马门户',
    layer: 'stellar',
    desc: '虫洞另一端的稳定跳跃点，通往邻近恒星系的门户',
    time: 5400,
    cost: { energy: 500000, data: 20000, dark: 15 },
    rewards: { energy: 3000000, crystal: 5000, alloy: 50000, data: 50000, dark: 30 },
    requires: ['node_deep'],
    unlocksStronghold: ['raider_4'],
    story:
      '穿过虫洞，三颗恒星的引力在远方彼此拉扯。门户残骸上刻着与先驱者相同的纹章——他们曾经也走过这条路。',
  },
  {
    id: 'node_stellar_mine',
    name: '碎晶星带',
    layer: 'stellar',
    desc: '双星撕碎行星形成的晶体碎片带，晶脉密度超乎想象',
    time: 7200,
    cost: { energy: 1500000, crystal: 20000, dark: 20 },
    rewards: { energy: 8000000, crystal: 30000, data: 120000 },
    requires: ['node_stellar_gate'],
    unlocksStronghold: ['beast_3'],
    story:
      '碎片带深处回荡着晶体共振的嗡鸣。扫描器捕捉到巨大的生物轮廓在晶尘中游弋——它们以晶脉为食。',
  },
  {
    id: 'node_stellar_forge',
    name: '熔炉星系',
    layer: 'stellar',
    desc: '年轻恒星与原行星盘交织的熔炉，合金矿脉富集',
    time: 7200,
    cost: { energy: 1500000, alloy: 100000, dark: 20 },
    rewards: { energy: 8000000, alloy: 200000, dark: 25 },
    requires: ['node_stellar_gate'],
    unlocksStronghold: ['ruin_3'],
    story:
      '原行星盘如熔炉般翻涌。在恒星的耀斑之间，一座人工建筑的剪影一闪而过——比掠夺者的技术精致得多。',
  },
  {
    id: 'node_stellar_dead',
    name: '死寂星系',
    layer: 'stellar',
    desc: '恒星早已熄灭的死地，唯有沉默者的信号在此回响',
    time: 10800,
    cost: { energy: 4000000, data: 80000, dark: 30 },
    rewards: { energy: 20000000, data: 300000, dark: 40 },
    requires: ['node_stellar_mine', 'node_stellar_forge'],
    unlocksStronghold: ['silencer_2'],
    story: '白矮星的残光下，一支殖民舰队的残骸静静悬浮。他们没有战斗过的痕迹——他们是安静地停止的。',
  },
  {
    id: 'node_stellar_core',
    name: '中子星残骸',
    layer: 'stellar',
    desc: '超新星爆发后的中子星，极端环境孕育极端造物',
    time: 14400,
    cost: { energy: 10000000, alloy: 500000, dark: 40 },
    rewards: { energy: 50000000, alloy: 1000000, dark: 60 },
    requires: ['node_stellar_dead'],
    unlocksStronghold: ['beast_4', 'raider_5'],
    story:
      '中子星的引力撕扯着舰体。在这片死亡的摇篮里，虚空巨兽产下了卵，掠夺者舰队却围绕它建立了母巢。',
  },
  {
    id: 'node_stellar_edge',
    name: '银河悬臂边缘',
    layer: 'stellar',
    desc: '已知世界的尽头，越过这里是浩瀚的星团深空',
    time: 28800,
    cost: { energy: 50000000, data: 500000, dark: 60 },
    rewards: { energy: 300000000, data: 2000000, dark: 120 },
    requires: ['node_stellar_core'],
    unlocksStronghold: ['silencer_3', 'ruin_4'],
    story:
      '悬臂尽头，沉默者旗舰的残骸缓缓旋转。黑匣子的最后一段记录只有一句话：「我们并非沉默，我们是在倾听。星团深处，有什么在回应。」',
  },
]

/** 探索节点查找 Map（O(1) 查找） */
const NODE_MAP = new Map(EXPLORE_NODES.map((n) => [n.id, n]))

export const getNode = (id: string): ExploreNode | undefined => NODE_MAP.get(id)
