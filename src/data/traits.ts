/**
 * traits.ts — 编队特性定义（v1.23 可玩内容扩展方案 7）
 *
 * 每支编队可从特性清单中选 1 项（含默认「均衡」），特性作用于该编队的
 * 战斗表现（攻击/血量/克制倍率）与该编队所驻据点的挂机产出。
 * 数值经阶段0 战斗模拟校准（脚本 ~/脚本/starcore-v123-trait-calib.py，
 * 2026-09-23 三档全绿：终层胜率零下降、远征前沿增量 0 层、软墙语义完好）。
 *
 * 生效面（编队口径，不污染全军语义）：
 *   - 战斗：resolveBattle 玩家单位构建处乘区（远征合成据点同走此函数自动覆盖）
 *   - 驻扎：garrisonIdleReward 按所驻编队特性乘区（在线 tick / 离线补算 / 预览
 *     三条消费路径全部经此单点，特性乘区一处生效全路覆盖）
 *   - 全军面板（totalPower）不乘特性
 */
import { t } from '@/i18n'

/** 特性 id（语言无关，随存档走；'balanced' 为默认值） */
export type TraitId =
  'balanced' | 'assault_doctrine' | 'bastion_doctrine' | 'counter_doctrine' | 'logistics_doctrine'

export interface TraitDef {
  id: TraitId
  /** 显示名（语言包键解析） */
  name: string
  /** 选择器短标签（语言包键解析） */
  short: string
  /** 效果描述（语言包键解析） */
  desc: string
  /** 攻击乘区（1 = 无加成） */
  atkMult: number
  /** 血量乘区（单兵 maxHp 上移，1 = 无加成） */
  hpMult: number
  /** 克制伤害倍率增量（加在兵种 counterMult 上） */
  counterBonus: number
  /** 驻扎挂机产出乘区（1 = 无加成） */
  garrisonMult: number
}

export const TRAITS: TraitDef[] = [
  {
    id: 'balanced',
    name: t('content.traits.balanced.name'),
    short: t('content.traits.balanced.short'),
    desc: t('content.traits.balanced.desc'),
    atkMult: 1,
    hpMult: 1,
    counterBonus: 0,
    garrisonMult: 1,
  },
  {
    id: 'assault_doctrine',
    name: t('content.traits.assault_doctrine.name'),
    short: t('content.traits.assault_doctrine.short'),
    desc: t('content.traits.assault_doctrine.desc'),
    atkMult: 1.12,
    hpMult: 1,
    counterBonus: 0,
    garrisonMult: 1,
  },
  {
    id: 'bastion_doctrine',
    name: t('content.traits.bastion_doctrine.name'),
    short: t('content.traits.bastion_doctrine.short'),
    desc: t('content.traits.bastion_doctrine.desc'),
    atkMult: 1,
    hpMult: 1.15,
    counterBonus: 0,
    garrisonMult: 1,
  },
  {
    id: 'counter_doctrine',
    name: t('content.traits.counter_doctrine.name'),
    short: t('content.traits.counter_doctrine.short'),
    desc: t('content.traits.counter_doctrine.desc'),
    atkMult: 1,
    hpMult: 1,
    counterBonus: 0.25,
    garrisonMult: 1,
  },
  {
    id: 'logistics_doctrine',
    name: t('content.traits.logistics_doctrine.name'),
    short: t('content.traits.logistics_doctrine.short'),
    desc: t('content.traits.logistics_doctrine.desc'),
    atkMult: 1,
    hpMult: 1,
    counterBonus: 0,
    garrisonMult: 1.2,
  },
]

/** 特性查找 Map（O(1)） */
const TRAIT_MAP = new Map(TRAITS.map((tr) => [tr.id, tr]))

/** 缺省特性 id（编队不带 trait 字段 / 未知 id 自愈时回落） */
export const DEFAULT_TRAIT_ID: TraitId = 'balanced'

/**
 * 按 id 取特性定义；未知 id / 缺省回落均衡（存档自愈口径：
 * trait 为可选字段，值不在白名单内不拒档，读取侧回落默认）。
 */
export function getTrait(id: string | undefined | null): TraitDef {
  return TRAIT_MAP.get((id ?? '') as TraitId) ?? TRAIT_MAP.get(DEFAULT_TRAIT_ID)!
}
