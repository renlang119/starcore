/**
 * explore.ts — 探索星图节点定义
 * 星图按距离分 9 层：轨道带、内层星系、外层星系、深空带、恒星系层、星团层、星臂层、星系层、深空层
 * 探索节点提供一次性奖励 + 解锁据点
 */

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
  orbit: { id: 'orbit', name: '轨道带', color: 'var(--color-core)', distance: '0.1-1 AU' },
  inner: { id: 'inner', name: '内层星系', color: 'var(--color-quantum)', distance: '1-50 AU' },
  outer: { id: 'outer', name: '外层星系', color: 'var(--color-amber)', distance: '50-5000 AU' },
  deep: { id: 'deep', name: '深空带', color: 'var(--color-plasma)', distance: '>5000 AU' },
  stellar: {
    id: 'stellar',
    name: '恒星系层',
    color: 'var(--color-layer-stellar)',
    distance: '4.2 ly+',
  },
  cluster: {
    id: 'cluster',
    name: '星团层',
    color: 'var(--color-layer-cluster)',
    distance: '>10 kly',
  },
  arm: { id: 'arm', name: '星臂层', color: 'var(--color-layer-arm)', distance: '30-80 kly' },
  galaxy: {
    id: 'galaxy',
    name: '星系层',
    color: 'var(--color-layer-galaxy)',
    distance: '>100 kly',
  },
  void: { id: 'void', name: '深空层', color: 'var(--color-layer-void)', distance: '银河之外' },
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
  },
  // —— 星团层（v0.71）——
  {
    id: 'node_cluster_gate',
    name: '星团之眼',
    layer: 'cluster',
    desc: '跃出悬臂后的第一片深空，整片星团的异常射电背景在此张开',
    time: 43200,
    cost: { energy: 100000000, data: 200000, dark: 60 },
    rewards: { energy: 600000000, data: 1200000, dark: 120 },
    requires: ['node_stellar_edge'],
  },
  {
    id: 'node_cluster_swarm',
    name: '晶云星团',
    layer: 'cluster',
    desc: '晶尘云笼罩的星团分支，漂浮着数以千计的静止殖民舰',
    time: 57600,
    cost: { energy: 300000000, data: 600000, dark: 90 },
    rewards: { energy: 1500000000, crystal: 300000, data: 3000000, dark: 180 },
    requires: ['node_cluster_gate'],
  },
  {
    id: 'node_cluster_ruin',
    name: '红拱遗迹',
    layer: 'cluster',
    desc: '先驱者天文台残骸构成的星团分支，红色拱廊横跨星海',
    time: 57600,
    cost: { energy: 300000000, data: 600000, alloy: 200000, dark: 90 },
    rewards: { energy: 1500000000, data: 3000000, alloy: 600000, dark: 180 },
    requires: ['node_cluster_gate'],
  },
  {
    id: 'node_cluster_heart',
    name: '星团之心',
    layer: 'cluster',
    desc: '两条分支汇合处的星团核心，一座环状人工结构悬浮于此',
    time: 72000,
    cost: { energy: 800000000, data: 1500000, dark: 120 },
    rewards: { energy: 4000000000, data: 8000000, crystal: 800000, dark: 240 },
    requires: ['node_cluster_swarm', 'node_cluster_ruin'],
  },
  {
    id: 'node_cluster_hollow',
    name: '虚无空洞',
    layer: 'cluster',
    desc: '环状结构内部的空腔，没有星体、没有尘埃，只有不断重复的询问',
    time: 79200,
    cost: { energy: 1500000000, data: 3000000, dark: 160 },
    rewards: { energy: 7500000000, data: 15000000, dark: 320 },
    requires: ['node_cluster_heart'],
  },
  {
    id: 'node_cluster_silence',
    name: '沉默之巢',
    layer: 'cluster',
    desc: '星团最深处的沉默者母港，一切信号的起点',
    time: 86400,
    cost: { energy: 3000000000, data: 6000000, dark: 200 },
    rewards: { energy: 18000000000, data: 40000000, dark: 400 },
    requires: ['node_cluster_hollow'],
  },
  // —— 星臂层（v0.90，敌人编成经战斗模拟脚本三档验证）——
  {
    id: 'node_arm_gate',
    name: '臂缘哨站',
    layer: 'arm',
    desc: '越过冻结之门后的第一座前沿哨站，整片星臂的轮廓在远方展开',
    time: 86400,
    cost: { energy: 3000000000, data: 6000000, dark: 200 },
    rewards: { energy: 15000000000, data: 12000000, dark: 400 },
    requires: ['node_cluster_silence'],
  },
  {
    id: 'node_arm_cradle',
    name: '摇篮星区',
    layer: 'arm',
    desc: '恒星尚在孕育中的原生星区，尘埃云里漂浮着巨兽的巢',
    time: 108000,
    cost: { energy: 8000000000, data: 15000000, crystal: 300000, dark: 250 },
    rewards: { energy: 40000000000, crystal: 1500000, data: 3000000, dark: 500 },
    requires: ['node_arm_gate'],
  },
  {
    id: 'node_arm_grave',
    name: '纹章墓场',
    layer: 'arm',
    desc: '整支先驱者远征舰队的长眠之地，舰脊上刻着同一枚纹章',
    time: 108000,
    cost: { energy: 8000000000, data: 15000000, alloy: 500000, dark: 250 },
    rewards: { energy: 40000000000, data: 3000000, alloy: 1500000, dark: 500 },
    requires: ['node_arm_gate'],
  },
  {
    id: 'node_arm_spine',
    name: '臂脊航道',
    layer: 'arm',
    desc: '沿星臂脊线铺开的古代航道，先驱者用它输送整支舰队',
    time: 129600,
    cost: { energy: 20000000000, data: 30000000, dark: 300 },
    rewards: { energy: 100000000000, data: 16000000, crystal: 2000000, dark: 600 },
    requires: ['node_arm_cradle', 'node_arm_grave'],
  },
  {
    id: 'node_arm_abyss',
    name: '无声深渊',
    layer: 'arm',
    desc: '臂脊航道内侧的空腔，连召回信号在这里也会沉默',
    time: 144000,
    cost: { energy: 40000000000, data: 60000000, dark: 350 },
    rewards: { energy: 200000000000, data: 30000000, dark: 800 },
    requires: ['node_arm_spine'],
  },
  {
    id: 'node_arm_threshold',
    name: '门扉回廊',
    layer: 'arm',
    desc: '星臂尽头并列的古代门扉，应答源的回响从门后传来',
    time: 172800,
    cost: { energy: 80000000000, data: 120000000, dark: 450 },
    rewards: { energy: 480000000000, data: 80000000, dark: 1000 },
    requires: ['node_arm_abyss'],
  },
  // —— 星系层（v0.91，敌人编成经战斗模拟脚本三档验证）——
  {
    id: 'node_galaxy_gate',
    name: '越门浅滩',
    layer: 'galaxy',
    desc: '穿过唯一应答的门扉后抵达的星系尺度浅滩，整条银河在下方展开',
    time: 172800,
    cost: { energy: 80000000000, data: 120000000, dark: 450 },
    rewards: { energy: 400000000000, data: 240000000, dark: 900 },
    requires: ['node_arm_threshold'],
  },
  {
    id: 'node_galaxy_range',
    name: '星尘牧场',
    layer: 'galaxy',
    desc: '银河盘面上的星尘草原，噬星鲲群在此放牧',
    time: 216000,
    cost: { energy: 200000000000, data: 300000000, crystal: 6000000, dark: 550 },
    rewards: { energy: 1000000000000, data: 60000000, crystal: 30000000, dark: 1100 },
    requires: ['node_galaxy_gate'],
  },
  {
    id: 'node_galaxy_archive',
    name: '先驱者总库',
    layer: 'galaxy',
    desc: '先驱者文明规模最大的数据库，纪年终止于同一日',
    time: 216000,
    cost: { energy: 200000000000, data: 300000000, alloy: 10000000, dark: 550 },
    rewards: { energy: 1000000000000, data: 60000000, alloy: 30000000, dark: 1100 },
    requires: ['node_galaxy_gate'],
  },
  {
    id: 'node_galaxy_hub',
    name: '银盘枢纽',
    layer: 'galaxy',
    desc: '两条分支汇合处的银盘航道枢纽，掠夺者帝庭的进贡终点',
    time: 259200,
    cost: { energy: 500000000000, data: 750000000, dark: 650 },
    rewards: { energy: 2500000000000, data: 400000000, crystal: 40000000, dark: 1400 },
    requires: ['node_galaxy_range', 'node_galaxy_archive'],
  },
  {
    id: 'node_galaxy_halo',
    name: '静默银晕',
    layer: 'galaxy',
    desc: '银河晕中的静默空腔，连中继链也绕开这里',
    time: 288000,
    cost: { energy: 1000000000000, data: 1500000000, dark: 800 },
    rewards: { energy: 5000000000000, data: 750000000, dark: 1800 },
    requires: ['node_galaxy_hub'],
  },
  {
    id: 'node_galaxy_heart',
    name: '银河之心',
    layer: 'galaxy',
    desc: '银心旁的沉默者主脑所在，应答源的实体',
    time: 345600,
    cost: { energy: 2000000000000, data: 3000000000, dark: 1000 },
    rewards: { energy: 12000000000000, data: 2000000000, dark: 2200 },
    requires: ['node_galaxy_halo'],
  },
  // —— 深空层（v0.92，敌人编成经战斗模拟脚本三档验证）——
  {
    id: 'node_void_gate',
    name: '银河彼岸',
    layer: 'void',
    desc: '穿出银河后的第一片虚空，中继链的尽头指向更深的黑暗',
    time: 345600,
    cost: { energy: 2000000000000, data: 60000000000, dark: 2900 },
    rewards: { energy: 10000000000000, data: 120000000000, dark: 6400 },
    requires: ['node_galaxy_heart'],
  },
  {
    id: 'node_void_beacon',
    name: '虚空航标',
    layer: 'void',
    desc: '虚空中仍规律闪烁的先驱者航标，灯语内容只有一句话',
    time: 432000,
    cost: { energy: 5300000000000, data: 160000000000, crystal: 160000000, dark: 3750 },
    rewards: { energy: 26500000000000, data: 320000000000, crystal: 800000000, dark: 8300 },
    requires: ['node_void_gate'],
  },
  {
    id: 'node_void_watch',
    name: '虚空望台',
    layer: 'void',
    desc: '先驱者建立的最后一座天文台，镜筒永远指向同一个坐标',
    time: 432000,
    cost: { energy: 5300000000000, data: 160000000000, alloy: 260000000, dark: 3750 },
    rewards: { energy: 26500000000000, data: 320000000000, alloy: 1300000000, dark: 8300 },
    requires: ['node_void_gate'],
  },
  {
    id: 'node_void_hub',
    name: '星幕枢纽',
    layer: 'void',
    desc: '虚空航道的汇合点，掠夺者舰群在此竖起了他们的界碑',
    time: 518400,
    cost: { energy: 13200000000000, data: 400000000000, dark: 4500 },
    rewards: { energy: 66000000000000, data: 800000000000, crystal: 1300000000, dark: 10000 },
    requires: ['node_void_beacon', 'node_void_watch'],
  },
  {
    id: 'node_void_veil',
    name: '静默星幕',
    layer: 'void',
    desc: '连回响都会被吞掉的星幕空腔，仿佛整个宇宙在此屏息',
    time: 576000,
    cost: { energy: 26500000000000, data: 800000000000, dark: 5350 },
    rewards: { energy: 132000000000000, data: 1600000000000, dark: 12300 },
    requires: ['node_void_hub'],
  },
  {
    id: 'node_void_origin',
    name: '信号源头',
    layer: 'void',
    desc: '一切信号的最初源头，先驱者出航影像的终点',
    time: 691200,
    cost: { energy: 53000000000000, data: 1600000000000, dark: 6100 },
    rewards: { energy: 265000000000000, data: 3200000000000, dark: 14000 },
    requires: ['node_void_veil'],
  },
]

/** 探索节点查找 Map（O(1) 查找） */
const NODE_MAP = new Map(EXPLORE_NODES.map((n) => [n.id, n]))

export const getNode = (id: string): ExploreNode | undefined => NODE_MAP.get(id)
