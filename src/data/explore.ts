/**
 * explore.ts — 探索星图节点定义
 * 星图按距离分 9 层：轨道带、内层系、外层系、深空、恒星系层、星团层、星臂层、星系层、深空层
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
  cluster: { id: 'cluster', name: '星团层', color: '#60A5FA', distance: '>10 kly' },
  arm: { id: 'arm', name: '星臂层', color: '#FB7185', distance: '30-80 kly' },
  galaxy: { id: 'galaxy', name: '星系层', color: '#FACC15', distance: '>100 kly' },
  void: { id: 'void', name: '深空层', color: '#38BDF8', distance: '银河之外' },
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
    unlocksStronghold: ['raider_6'],
    story:
      '跃出悬臂，星团如眼睑在深空缓缓张开。扫描器捕捉到覆盖整片星团的异常射电背景，节奏与沉默者黑匣子的信号完全一致。',
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
    unlocksStronghold: ['beast_5'],
    story: '晶尘云中漂浮着数以千计的静止殖民舰，舷窗内的面孔完好如初。它们不是死去，是在等待。',
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
    unlocksStronghold: ['ruin_5'],
    story:
      '先驱者天文台残骸，记录着同一信号来源：星团核心，一支比先驱文明更古老的舰队。先驱者在记录末尾写道：「我们造了一扇门，却不知道门后面是谁。」',
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
    unlocksStronghold: ['raider_7'],
    story: '星团核心是一座环状人工结构。回响定位完成：信号起源于它，且是持续发讯，已历数十亿年。',
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
    story:
      '结构内部空无一物，只有不断重复的询问。黑匣子接口接入后，询问终于获得回答：「开始回归。接收者已就绪。」',
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
    unlocksStronghold: ['silencer_4'],
    story:
      '沉默者的母港。他们不是沉默，是在守门。门已在开启前的一瞬被冻结，文明在完成使命前的最后时刻停工，等待来自星团的「召回信号」。我们触发了它。',
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
    unlocksStronghold: ['raider_8'],
    story:
      '门的彼端没有毁灭，只有一条被遗弃的航道。召回信号的应答源在相邻星臂深处规律闪烁，像一颗为归乡者留的灯。掠夺者早已在门这边扎下了王庭。',
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
    unlocksStronghold: ['beast_6'],
    story:
      '信号在摇篮星区变得格外清晰，仿佛「接收者」就藏在每一颗原恒星的胎动里。织网兽以静止的殖民舰为巢，晶丝横贯整片云带，把摇篮缠成了一枚茧。',
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
    unlocksStronghold: ['ruin_6'],
    story:
      '数千艘先驱者战舰在同一时刻停止了引擎，没有战损，没有逃生舱。它们环绕成一道长堤，舰脊的纹章与环状结构上的完全一致——这支舰队是守门者的先行者。',
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
    unlocksStronghold: ['raider_9'],
    story:
      '两条分支在臂脊汇合。航道的每一座驿站都完好无损，仿佛舰队只是暂时离港。劫掠者的王庭舰队盘踞在航道枢纽，把整条古代航道当成了它们的私产。',
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
    story:
      '航道内侧是一片连信号都无法逃逸的空腔。守门者留下的最后记录写道：「深渊不是终点，是过滤器。能被听见的，才配得上穿过门扉。」',
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
    unlocksStronghold: ['silencer_5'],
    story:
      '回廊尽头并列着七扇与冻结之门同款的巨门，只有一扇门的应答源仍在工作。信号穿门而出，指向的不是星臂深处，而是整条银河的尺度——门后的存在，在星系层面等我们。',
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
    unlocksStronghold: ['raider_10'],
    story:
      '穿过唯一应答的门扉，门后不是房间，是整条银河。七扇门的应答源在此汇成一条仍在发讯的中继链，笔直指向银心。',
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
    unlocksStronghold: ['beast_7'],
    story:
      '银河盘面上，噬星鲲群像牧群一样啃食星尘。它们的迁徙路线整齐地绕开某些空域，像在听从某种驱赶。',
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
    unlocksStronghold: ['ruin_7'],
    story:
      '先驱者总库的纪年终止于同一日：「门已交给守门者。我们出发去银河之外，寻找最初的发讯者。」',
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
    unlocksStronghold: ['raider_11'],
    story:
      '掠夺者所有王庭的进贡终点。他们相信银心藏着永不熄灭的炉，把整条银河的航道当成了献给炉火的柴。',
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
    story: '银河晕中的静默空腔，连中继链也绕开这里。守门者的石刻写着：「最亮的地方，影子最深。」',
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
    unlocksStronghold: ['silencer_6'],
    story:
      '银心旁，沉默者主脑在此沉睡，它是所有守门者的中枢，也是应答源的实体。接触完成的瞬间，它回放了先驱者的出航影像，并给出一组坐标：信号的最初源头，在银河之外。',
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
    unlocksStronghold: ['raider_12'],
    story:
      '出航影像的终点就是这里。银河在身后收拢成一枚光点，中继链在虚空边缘断开，断口处的坐标仍在闪烁——先驱者从这里离开了自己的星系。',
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
    unlocksStronghold: ['beast_8'],
    story:
      '航标仍在工作，灯语只有一句：「航向未变。」白鲸群聚集在航标周围，像在等待一盏为它们亮了亿万年的灯。',
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
    unlocksStronghold: ['ruin_8'],
    story:
      '望台的观测记录停在同一日：镜筒里的光点没有移动过，记录的最后写着「源头静止，非天体，非讯号，是一扇门」。',
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
    unlocksStronghold: ['raider_13'],
    story:
      '两条虚空航道在此汇成一条。掠夺者把界碑竖在航道正中，碑文却抄自先驱者：「越过此界者，不再归航。」他们没有读懂这句话。',
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
    story:
      '星幕之内，所有信号都失去了回声。主脑的回放影像在这里最后一次定格：先驱者的旗舰驶入光点，影像结束了，光点还在。',
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
    unlocksStronghold: ['silencer_7'],
    story:
      '信号的源头不是信标，是一座门。先驱者没有离开——他们穿门而入，沉默者世代守着这扇门。接触完成的瞬间，门后的回响第一次开口：「接收者已抵达。欢迎回家。」',
  },
]

/** 探索节点查找 Map（O(1) 查找） */
const NODE_MAP = new Map(EXPLORE_NODES.map((n) => [n.id, n]))

export const getNode = (id: string): ExploreNode | undefined => NODE_MAP.get(id)
