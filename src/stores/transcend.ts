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
import { t } from '@/i18n'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { D, Decimal, ser, deser } from '@/lib/decimal'
import { aggregateMult, aggregateValue } from '@/lib/effect-system'
import { repeatUntilFail, simulateSteps } from '@/lib/batch'
import { ceilPow } from '@/lib/cost'
import type { EffectTypeBase } from '@/lib/effect-types'
import type { TranscendSaveData } from '@/lib/storage'

export interface TranscendEffect {
  type:
    | EffectTypeBase
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

/** 节点在给定等级处的下一级购买成本（缺省当前等级；买断节点 = 基础成本；无限节点 = 指数递增取整） */
export function nextCost(node: TranscendNode, level = node.level): number {
  if (!isInfiniteNode(node)) return node.cost
  return ceilPow(node.cost, node.costGrowth ?? 1.5, level)
}

// 导出供守恒脚本取真值（转生树节点清单），运行期消费方为本文件内部
export const DEFAULT_NODES: TranscendNode[] = [
  // —— 买断节点（引导期目标，原 11 节点口径不变）——
  {
    id: 't_energy_1',
    name: t('content.transcend.t_energy_1.name'),
    desc: t('content.transcend.t_energy_1.desc'),
    cost: 1,
    effects: [
      {
        type: 'production_mult',
        target: 'energy',
        value: 1.5,
        label: t('content.transcend.t_energy_1.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_alloy_1',
    name: t('content.transcend.t_alloy_1.name'),
    desc: t('content.transcend.t_alloy_1.desc'),
    cost: 1,
    effects: [
      {
        type: 'production_mult',
        target: 'alloy',
        value: 1.5,
        label: t('content.transcend.t_alloy_1.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_data_1',
    name: t('content.transcend.t_data_1.name'),
    desc: t('content.transcend.t_data_1.desc'),
    cost: 2,
    effects: [
      {
        type: 'production_mult',
        target: 'data',
        value: 1.5,
        label: t('content.transcend.t_data_1.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_crystal_1',
    name: t('content.transcend.t_crystal_1.name'),
    desc: t('content.transcend.t_crystal_1.desc'),
    cost: 2,
    effects: [
      {
        type: 'production_mult',
        target: 'crystal',
        value: 1.5,
        label: t('content.transcend.t_crystal_1.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_starting',
    name: t('content.transcend.t_starting.name'),
    desc: t('content.transcend.t_starting.desc'),
    cost: 2,
    effects: [
      {
        type: 'starting_energy',
        value: 10,
        label: t('content.transcend.t_starting.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_slot',
    name: t('content.transcend.t_slot.name'),
    desc: t('content.transcend.t_slot.desc'),
    cost: 3,
    effects: [
      { type: 'relic_slot', value: 1, label: t('content.transcend.t_slot.effect.0.label') },
    ],
    level: 0,
  },
  {
    id: 't_dark_1',
    name: t('content.transcend.t_dark_1.name'),
    desc: t('content.transcend.t_dark_1.desc'),
    cost: 5,
    effects: [
      {
        type: 'production_mult',
        target: 'dark',
        value: 1.5,
        label: t('content.transcend.t_dark_1.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_energy_2',
    name: t('content.transcend.t_energy_2.name'),
    desc: t('content.transcend.t_energy_2.desc'),
    cost: 5,
    effects: [
      {
        type: 'production_mult',
        target: 'energy',
        value: 2.0,
        label: t('content.transcend.t_energy_2.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_combat_1',
    name: t('content.transcend.t_combat_1.name'),
    desc: t('content.transcend.t_combat_1.desc'),
    cost: 5,
    effects: [
      {
        type: 'combat_mult',
        target: 'attack',
        value: 1.3,
        label: t('content.transcend.t_combat_1.effect.0.label'),
      },
      {
        type: 'combat_mult',
        target: 'defense',
        value: 1.3,
        label: t('content.transcend.t_combat_1.effect.1.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_offline',
    name: t('content.transcend.t_offline.name'),
    desc: t('content.transcend.t_offline.desc'),
    cost: 6,
    effects: [
      { type: 'offline_bonus', value: 1.5, label: t('content.transcend.t_offline.effect.0.label') },
    ],
    level: 0,
  },
  {
    id: 't_prestige_boost',
    name: t('content.transcend.t_prestige_boost.name'),
    desc: t('content.transcend.t_prestige_boost.desc'),
    cost: 8,
    effects: [
      {
        type: 'prestige_mult',
        value: 2.0,
        label: t('content.transcend.t_prestige_boost.effect.0.label'),
      },
    ],
    level: 0,
  },
  // —— 自动化 QoL（v0.58 新增，买断常开：买后每 tick 自动执行对应操作）——
  {
    id: 't_auto_build',
    name: t('content.transcend.t_auto_build.name'),
    desc: t('content.transcend.t_auto_build.desc'),
    cost: 10,
    effects: [
      { type: 'auto_build', value: 1, label: t('content.transcend.t_auto_build.effect.0.label') },
    ],
    level: 0,
  },
  {
    id: 't_auto_research',
    name: t('content.transcend.t_auto_research.name'),
    desc: t('content.transcend.t_auto_research.desc'),
    cost: 10,
    effects: [
      {
        type: 'auto_research',
        value: 1,
        label: t('content.transcend.t_auto_research.effect.0.label'),
      },
    ],
    level: 0,
  },
  {
    id: 't_auto_explore',
    name: t('content.transcend.t_auto_explore.name'),
    desc: t('content.transcend.t_auto_explore.desc'),
    cost: 8,
    effects: [
      {
        type: 'auto_explore',
        value: 1,
        label: t('content.transcend.t_auto_explore.effect.0.label'),
      },
    ],
    level: 0,
  },
  // —— 无限节点（v0.56 新增，负熵支出端永不枯竭）——
  {
    id: 't_inf_prod',
    name: t('content.transcend.t_inf_prod.name'),
    desc: t('content.transcend.t_inf_prod.desc'),
    cost: 5,
    effects: [
      {
        type: 'production_mult',
        target: 'all',
        value: 1.1,
        label: t('content.transcend.t_inf_prod.effect.0.label'),
      },
    ],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.5,
  },
  {
    id: 't_inf_combat',
    name: t('content.transcend.t_inf_combat.name'),
    desc: t('content.transcend.t_inf_combat.desc'),
    cost: 5,
    effects: [
      {
        type: 'combat_mult',
        target: 'attack',
        value: 1.05,
        label: t('content.transcend.t_inf_combat.effect.0.label'),
      },
      {
        type: 'combat_mult',
        target: 'defense',
        value: 1.05,
        label: t('content.transcend.t_inf_combat.effect.1.label'),
      },
    ],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.5,
  },
  {
    id: 't_inf_explore',
    name: t('content.transcend.t_inf_explore.name'),
    desc: t('content.transcend.t_inf_explore.desc'),
    cost: 6,
    effects: [
      {
        type: 'explore_mult',
        value: 1.1,
        label: t('content.transcend.t_inf_explore.effect.0.label'),
      },
    ],
    level: 0,
    maxLevel: Infinity,
    costGrowth: 1.5,
  },
  {
    id: 't_inf_offline',
    name: t('content.transcend.t_inf_offline.name'),
    desc: t('content.transcend.t_inf_offline.desc'),
    cost: 8,
    effects: [
      {
        type: 'offline_bonus',
        value: 1.1,
        label: t('content.transcend.t_inf_offline.effect.0.label'),
      },
    ],
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

/**
 * 无限节点 id 集合与等级硬上限（v0.81 存档安全）：
 * 校验层拒绝 level 超限的条目，防超大等级值经 allEffects 物化数组挂死首帧。
 * 上限远超正常进度可达值（按 costGrowth 1.5 的指数成本，正收益玩法内不可能触顶）。
 */
export const INFINITE_NODE_IDS: ReadonlySet<string> = new Set(
  DEFAULT_NODES.filter(isInfiniteNode).map((n) => n.id)
)
export const MAX_INFINITE_NODE_LEVEL = 1_000_000

export const useTranscendStore = defineStore('transcend', () => {
  const negativeEntropy = ref<Decimal>(D(0)) // 负熵余额
  const totalTranscends = ref(0) // 转生次数
  const tree = ref<TranscendNode[]>(cloneDefaultNodes())

  /**
   * 转生树已购节点的效果汇总（v0.81 幂聚合：不再按等级物化数组）。
   * 同一节点 effects 只出现一次，重复次数记入 repeat：
   * 乘数型（getMult 乘法通道）实际乘数 = value^repeat，
   * 加法型（getValue 累加通道）实际值 = value×repeat。
   * 旧实现按 level 逐份 push，超大等级值的存档会在 init 首帧同步物化
   * 数十亿元素挂死主线程——校验层等级上限之外的第二道防线
   */
  const allEffects = computed(() => {
    const list: (TranscendEffect & { repeat: number })[] = []
    for (const node of tree.value) {
      if (node.level <= 0) continue
      for (const eff of node.effects) list.push({ ...eff, repeat: node.level })
    }
    return list
  })

  function getMult(type: string, target?: string): Decimal {
    return aggregateMult(allEffects.value, type, target)
  }

  /** 获取某属性值（非乘数型效果，如 starting_energy, relic_slot） */
  function getValue(type: string): number {
    return aggregateValue(allEffects.value, type)
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

  /**
   * 批量购买转生树节点（v0.86）：至多 steps 级、买满语义。
   * 无限节点逐级复用 purchaseNode（每级成本重算，负熵耗尽或达
   * maxLevel 自然停止）；买断节点 maxLevel=1，批量与单次等价。
   */
  function purchaseNodeSteps(id: string, steps: number): number {
    return repeatUntilFail(steps, () => purchaseNode(id))
  }

  /**
   * 批量购买预览（v0.94）：返回当前负熵下点击一次批量购买的实际
   * 可买级数与逐级累计总花费。逐级取价与扣费模拟同 purchaseNodeSteps
   * 的实扣顺序一致（负熵不足或达节点上限自然停止，最多 steps 级），
   * 供 ×N>1 档位在成本行展示「可买级数 + 预计总花费」。
   */
  function previewPurchaseSteps(id: string, steps: number): { count: number; cost: number } {
    const node = tree.value.find((n) => n.id === id)
    if (!node || steps < 1) return { count: 0, cost: 0 }
    const cap = node.maxLevel ?? 1
    const r = simulateSteps(
      steps,
      node.level,
      (level) => ({ neg: nextCost(node, level) }),
      { neg: negativeEntropy.value },
      (level) => level < cap
    )
    return { count: r.count, cost: r.cost.neg ?? 0 }
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
    if (data.negativeEntropy) {
      const v = deser(data.negativeEntropy)
      // 兜底钳 0（v0.81 双道防线之二）：deser 结果非有限（如极端指数）时取 0，
      // 不让非有限值进入游戏状态经 ser 再写出不可读档的串
      negativeEntropy.value = v.isFinite() ? v : D(0)
    }
    // 0 是合法值（导入替换语义需能清零），仅跳过 undefined
    if (data.totalTranscends !== undefined) totalTranscends.value = data.totalTranscends
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
    purchaseNodeSteps,
    previewPurchaseSteps,
    reset,
    serialize,
    hydrate,
  }
})
