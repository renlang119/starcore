/**
 * transcend.ts — 转生（奇点重启）系统 store
 * 重置大部分进度，获得负熵（永久货币），提升全局产出
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
  target?: string
  value: number
  label: string
}

export interface TranscendNode {
  id: string
  name: string
  desc: string
  cost: number // 负熵消耗
  effects: TranscendEffect[]
  purchased: boolean
}

const DEFAULT_NODES: TranscendNode[] = [
  {
    id: 't_energy_1',
    name: '能量觉醒',
    desc: '能量建筑产出永久 +50%',
    cost: 1,
    effects: [{ type: 'production_mult', target: 'energy', value: 1.5, label: '能量产出 ×1.5' }],
    purchased: false,
  },
  {
    id: 't_alloy_1',
    name: '合金觉醒',
    desc: '合金建筑产出永久 +50%',
    cost: 1,
    effects: [{ type: 'production_mult', target: 'alloy', value: 1.5, label: '合金产出 ×1.5' }],
    purchased: false,
  },
  {
    id: 't_data_1',
    name: '数据觉醒',
    desc: '数据建筑产出永久 +50%',
    cost: 2,
    effects: [{ type: 'production_mult', target: 'data', value: 1.5, label: '数据产出 ×1.5' }],
    purchased: false,
  },
  {
    id: 't_crystal_1',
    name: '晶体觉醒',
    desc: '晶体建筑产出永久 +50%',
    cost: 2,
    effects: [{ type: 'production_mult', target: 'crystal', value: 1.5, label: '晶体产出 ×1.5' }],
    purchased: false,
  },
  {
    id: 't_starting',
    name: '初始加速',
    desc: '每次转生后初始能量 ×10',
    cost: 2,
    effects: [{ type: 'starting_energy', value: 10, label: '初始能量 ×10' }],
    purchased: false,
  },
  {
    id: 't_slot',
    name: '遗物扩展',
    desc: '解锁第 5 个遗物槽位',
    cost: 3,
    effects: [{ type: 'relic_slot', value: 1, label: '+1 遗物槽' }],
    purchased: false,
  },
  {
    id: 't_dark_1',
    name: '暗物质觉醒',
    desc: '暗物质建筑产出永久 +50%',
    cost: 5,
    effects: [{ type: 'production_mult', target: 'dark', value: 1.5, label: '暗物质产出 ×1.5' }],
    purchased: false,
  },
  {
    id: 't_energy_2',
    name: '能量共鸣',
    desc: '能量建筑产出再 +100%',
    cost: 5,
    effects: [{ type: 'production_mult', target: 'energy', value: 2.0, label: '能量产出 ×2' }],
    purchased: false,
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
    purchased: false,
  },
  {
    id: 't_offline',
    name: '时间之主',
    desc: '离线收益再 +50%',
    cost: 6,
    effects: [{ type: 'offline_bonus', value: 1.5, label: '离线收益 ×1.5' }],
    purchased: false,
  },
  {
    id: 't_prestige_boost',
    name: '负熵循环',
    desc: '转生获得的负熵 ×2',
    cost: 8,
    effects: [{ type: 'prestige_mult', value: 2.0, label: '负熵 ×2' }],
    purchased: false,
  },
]

export const useTranscendStore = defineStore('transcend', () => {
  const negativeEntropy = ref<Decimal>(D(0)) // 负熵余额
  const totalTranscends = ref(0) // 转生次数
  const tree = ref<TranscendNode[]>(JSON.parse(JSON.stringify(DEFAULT_NODES)))

  /** 转生树已购节点的效果汇总 */
  const allEffects = computed(() => {
    const list: TranscendNode['effects'] = []
    for (const node of tree.value) {
      if (node.purchased) list.push(...node.effects)
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

  /** 购买转生树节点 */
  function purchaseNode(id: string): boolean {
    const node = tree.value.find((n) => n.id === id)
    if (!node || node.purchased) return false
    if (negativeEntropy.value.lt(node.cost)) return false
    negativeEntropy.value = negativeEntropy.value.minus(node.cost)
    node.purchased = true
    return true
  }

  function reset(fullReset = false) {
    if (fullReset) {
      negativeEntropy.value = D(0)
      totalTranscends.value = 0
      tree.value = JSON.parse(JSON.stringify(DEFAULT_NODES))
    }
    // 非 full 时不重置负熵和树（转生保留这些）
  }

  function serialize() {
    return {
      negativeEntropy: ser(negativeEntropy.value),
      totalTranscends: totalTranscends.value,
      tree: tree.value.map((n) => ({ id: n.id, purchased: n.purchased })),
    }
  }
  function hydrate(data: TranscendSaveData | undefined) {
    if (!data) return
    if (data.negativeEntropy) negativeEntropy.value = deser(data.negativeEntropy)
    if (data.totalTranscends) totalTranscends.value = data.totalTranscends
    if (data.tree) {
      for (const saved of data.tree) {
        const node = tree.value.find((n) => n.id === saved.id)
        if (node) node.purchased = saved.purchased
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
