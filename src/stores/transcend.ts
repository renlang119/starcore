/**
 * transcend.ts — 转生（奇点重启）系统 store
 * 重置大部分进度，获得负熵（永久货币），提升全局产出
 *
 * 节点分两类（v0.56 转生树无限化）：
 * - 买断节点：maxLevel 缺省 = 1，购买一次后 level = 1（原 purchased 语义）
 * - 无限节点：maxLevel = Infinity，可重复购买，成本按 costGrowth 指数递增，
 *   效果按 level 叠加（乘数型连乘 level 次 = value^level）
 *
 * 平衡性设计意图：负熵收入 = sqrt(总能量/3e5)（sqrt 压缩），
 * 无限节点成本按 growth^level 指数上涨 → 等级增速对数级放缓，自收敛不发散；
 * 负熵支出端永不枯竭，转生循环永久成立。
 *
 * 故意不无限化的效果类型：
 * - prestige_mult：无限化形成「负熵生负熵」失控正反馈
 * - relic_slot / starting_energy：无限叠加直接失衡（无限槽位、初始能量爆炸）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { D, Decimal, ser, deser } from '@/lib/decimal'
import type { TranscendSaveData } from '@/lib/storage'

export interface TranscendEffect {
  type:
    | 'production_mult'
    | 'combat_mult'
    | 'explore_mult'
    | 'prestige_mult'
    | 'offline_bonus'
    | 'relic_slot'
    | 'starting_energy'
    | 'auto_build'
    | 'auto_research'
    | 'auto_explore'
  target?: string
  value: number
  label: string
}

export interface TranscendNode {
  id: string
  name: string
  desc: string
  cost: number // 负熵基础成本（无限节点为 Lv1 成本）
  effects: TranscendEffect[]
  /** 当前等级：0 = 未购；买断节点购后 = 1 */
  level: number
  /** 等级上限，缺省 1 = 买断节点；无限节点设 Infinity */
  maxLevel?: number
  /** 无限节点成本增长率：nextCost = ceil(cost × costGrowth^level) */
  costGrowth?: number
}

/** 无限节点判定：maxLevel 显式大于 1（含 Infinity） */
export function isInfiniteNode(node: TranscendNode): boolean {
  return (node.maxLevel ?? 1) > 1
}

/** 节点下一级购买成本（买断节点 = 基础成本；无限节点 = 指数递增取整） */
export function nextCost(node: TranscendNode): number {
  if (!isInfiniteNode(node)) return node.cost
  return Math.ceil(node.cost * Math.pow(node.costGrowth ?? 1.5, node.level))
}

const DEFAULT_NODES: TranscendNode[] = [
  // —— 买断节点（引导期目标，原 11 节点口径不变）——
  {
    id: 't_energy_1',
    name: '能量觉醒',
    desc: '能量建筑产出永久 +50%',
    cost: 1,
    effects: [{ type: 'production_mult', target: 'energy', value: 1.5, label: '能量产出 ×1.5' }],
    level: 0,
  },
  {
    id: 't_alloy_1',
    name: '合金觉醒',
    desc: '合金建筑产出永久 +50%',
    cost: 1,
    effects: [{ type: 'production_mult', target: 'alloy', value: 1.5, label: '合金产出 ×1.5' }],
    level: 0,
  },
  {
    id: 't_data_1',
    name: '数据觉醒',
    desc: '数据建筑产出永久 +50%',
    cost: 2,
    effects: [{ type: 'production_mult', target: 'data', value: 1.5, label: '数据产出 ×1.5' }],
    level: 0,
  },
  {
    id: 't_crystal_1',
    name: '晶体觉醒',
    desc: '晶体建筑产出永久 +50%',
    cost: 2,
    effects: [{ type: 'production_mult', target: 'crystal', value: 1.5, label: '晶体产出 ×1.5' }],
    level: 0,
  },
  {
    id: 't_starting',
    name: '初始加速',
    desc: '每次转生后初始能量 ×10',
    cost: 2,
    effects: [{ type: 'starting_energy', value: 10, label: '初始能量 ×10' }],
    level: 0,
  },
  {
    id: 't_slot',
    name: '遗物扩展',
    desc: '解锁第 5 个遗物槽位',
    cost: 3,
    effects: [{ type: 'relic_slot', value: 1, label: '+1 遗物槽' }],
    level: 0,
  },
  {
    id: 't_dark_1',
    name: '暗物质觉醒',
    desc: '暗物质建筑产出永久 +50%',
    cost: 5,
    effects: [{ type: 'production_mult', target: 'dark', value: 1.5, label: '暗物质产出 ×1.5' }],
    level: 0,
  },
  {
    id: 't_energy_2',
    name: '能量共鸣',
    desc: '能量建筑产出再 +100%',
    cost: 5,
    effects: [{ type: 'production_mult', target: 'energy', value: 2.0, label: '能量产出 ×2' }],
    level: 0,
  },
  {
    id: 't_combat_1',
    name: '军事传承',
    desc: '部队攻防永久 +30%',
    cost: 5,
    effects: [
      { type: 'combat_mult', target: 'attack', value: 1.3, label: '攻击 ×1.3' },
      { type: 'combat_mult', target: 'defense', value: 1.3, label: '防御 ×1.3' },
    ],
    level: 0,
  },
  {
    id: 't_offline',
    name: '时间之主',
    desc: '离线收益再 +50%',
    cost: 6,
    effects: [{ type: 'offline_bonus', value: 1.5, label: '离线收益 ×1.5' }],
    level: 0,
  },
  {
    id: 't_prestige_boost',
    name: '负熵循环',
    desc: '转生获得的负熵 ×2',
    cost: 8,
    effects: [{ type: 'prestige_mult', value: 2.0, label: '负熵 ×2' }],
    level: 0,
  },
  // —— 自动化 QoL（v0.58 新增，买断常开：买后每 tick 自动执行对应操作）——
  {
    id: 't_auto_build',
    name: '建造协议',
    desc: '自动升级买得起的已解锁建筑（每 tick 一级）',
    cost: 10,
    effects: [{ type: 'auto_build', value: 1, label: '自动建造' }],
    level: 0,
  },
  {
    id: 't_auto_research',
    name: '研究协议',
    desc: '自动研究买得起的可用科技',
    cost: 10,
    effects: [{ type: 'auto_research', value: 1, label: '自动研究' }],
    level: 0,
  },
  {
    id: 't_auto_explore',
    name: '探索协议',
    desc: '自动开始可探索的星域节点（在线时）',
    cost: 8,
    effects: [{ type: 'auto_explore', value: 1, label: '自动探索' }],
    level: 0,
  },
  // —— 无限节点（v0.56 新增，负熵支出端永不枯竭）——
  {
    id: 't_inf_prod',
    name: '奇点共振',
    desc: '全资源产出每级永久 +10%，可重复购买',
    cost: 5,
    effects: [{ type: 'production_mult', target: 'all', value: 1.1, label: '全产出 ×1.1/级' }],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.5,
  },
  {
    id: 't_inf_combat',
    name: '战争遗产',
    desc: '部队攻防每级永久 +5%，可重复购买',
    cost: 5,
    effects: [
      { type: 'combat_mult', target: 'attack', value: 1.05, label: '攻击 ×1.05/级' },
      { type: 'combat_mult', target: 'defense', value: 1.05, label: '防御 ×1.05/级' },
    ],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.5,
  },
  {
    id: 't_inf_explore',
    name: '深空航行',
    desc: '探索效率每级永久 +10%，可重复购买',
    cost: 6,
    effects: [{ type: 'explore_mult', value: 1.1, label: '探索效率 ×1.1/级' }],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.5,
  },
  {
    id: 't_inf_offline',
    name: '时间膨胀',
    desc: '离线收益每级永久 +10%，可重复购买',
    cost: 8,
    effects: [{ type: 'offline_bonus', value: 1.1, label: '离线收益 ×1.1/级' }],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.6,
  },
]

/** 克隆默认节点表。注意不能用 JSON 往返——Infinity 会被序列化为 null，
 *  无限节点的 maxLevel 会退化成买断语义 */
function cloneDefaultNodes(): TranscendNode[] {
  return DEFAULT_NODES.map((n) => ({ ...n, effects: n.effects.map((e) => ({ ...e })) }))
}

export const useTranscendStore = defineStore('transcend', () => {
  const negativeEntropy = ref<Decimal>(D(0)) // 负熵余额
  const totalTranscends = ref(0) // 转生次数
  const tree = ref<TranscendNode[]>(cloneDefaultNodes())

  /** 转生树已购节点的效果汇总（效果按等级叠加：每级推入一份） */
  const allEffects = computed(() => {
    const list: TranscendNode['effects'] = []
    for (const node of tree.value) {
      for (let i = 0; i < node.level; i++) list.push(...node.effects)
    }
    return list
  })

  function getMult(type: string, target?: string): Decimal {
    let m = D(1)
    for (const eff of allEffects.value) {
      if (eff.type !== type) continue
      if (target && eff.target && eff.target !== target && eff.target !== 'all') continue
      m = m.times(eff.value)
    }
    return m
  }

  /** 获取某属性值（非乘数型效果，如 starting_energy, relic_slot） */
  function getValue(type: string): number {
    let v = 0
    for (const eff of allEffects.value) {
      if (eff.type === type) v += eff.value
    }
    return v
  }

  /** 预估可获得的负熵（基于当前历史总能量） */
  function previewNegEntropy(totalEnergy: Decimal, prestigeMult: Decimal): Decimal {
    if (totalEnergy.lt(3e5)) return D(0)
    // 公式：sqrt(totalEnergy / 3e5) * 1 * prestigeMult
    const base = totalEnergy.div(3e5).sqrt().times(prestigeMult).floor()
    // 首次转生保底 +1 负熵（首转至少 2 负熵，可同时购买 t_energy_1 + t_alloy_1）
    if (totalTranscends.value === 0) return base.plus(1)
    return base
  }

  /** 执行转生 */
  function transcend(gain: Decimal) {
    negativeEntropy.value = negativeEntropy.value.plus(gain)
    totalTranscends.value++
  }

  /** 购买转生树节点（买断节点一次封顶；无限节点可重复购买） */
  function purchaseNode(id: string): boolean {
    const node = tree.value.find((n) => n.id === id)
    if (!node) return false
    if (node.level >= (node.maxLevel ?? 1)) return false
    const cost = nextCost(node)
    if (negativeEntropy.value.lt(cost)) return false
    negativeEntropy.value = negativeEntropy.value.minus(cost)
    node.level++
    return true
  }

  function reset(fullReset = false) {
    if (fullReset) {
      negativeEntropy.value = D(0)
      totalTranscends.value = 0
      tree.value = cloneDefaultNodes()
    }
    // 非 full 时不重置负熵和树（转生保留这些）
  }

  function serialize() {
    return {
      negativeEntropy: ser(negativeEntropy.value),
      totalTranscends: totalTranscends.value,
      tree: tree.value.map((n) => ({ id: n.id, level: n.level })),
    }
  }
  function hydrate(data: TranscendSaveData | undefined) {
    if (!data) return
    if (data.negativeEntropy) negativeEntropy.value = deser(data.negativeEntropy)
    if (data.totalTranscends) totalTranscends.value = data.totalTranscends
    if (data.tree) {
      for (const saved of data.tree) {
        const node = tree.value.find((n) => n.id === saved.id)
        if (!node) continue
        // 防御：level 非法（缺失/非有限数）跳过该条目
        if (typeof saved.level !== 'number' || !isFinite(saved.level)) continue
        // 防御：等级不得超过节点上限，且必须为非负整数
        node.level = Math.max(0, Math.min(Math.floor(saved.level), node.maxLevel ?? 1))
      }
    }
  }

  return {
    negativeEntropy,
    totalTranscends,
    tree,
    allEffects,
    getMult,
    getValue,
    previewNegEntropy,
    transcend,
    purchaseNode,
    reset,
    serialize,
    hydrate,
  }
})
