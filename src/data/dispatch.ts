/**
 * dispatch.ts — 派遣远征定义（v1.27 可玩内容扩展方案 6）
 *
 * 编队派驻执行任务的挂机收益：整支编队派出，绝对时间戳到点后一次性带回资源。
 * 与驻扎（据点持续每秒产出）互补：刚解锁期驻扎占优、远征前沿 D10 后派遣反超
 * （EV 核验表交叉点 best≈10.2）。
 *
 * 数值口径（方案 8 EV 核验表法流程，`~/脚本/starcore-v127-dispatch-ev.py`
 * PASS 口径进测试基线，改数值前先改核验表再同步此处）：
 * - 奖励 = silencer_3 奖励五资源 × 1.35^(max(1,best)-1) × 时长权重 × 特性乘区，
 *   与 endlessStronghold 同源锚玩家远征前沿（expeditionBest 终身数据，实时派生不冻结，
 *   周强敌同口径）；relicChance/relicRarityBias 不入派遣奖励（纯资源包）
 * - 时长档位 4/8/12/24h，权重 1.0/2.2/3.6/8.0（每小时费率单调不减）
 * - 提前召回按已过时长占比结算（round(全额 × t/H)），反复短派小时收益恒为 w/H 无套利
 * - 后勤特性 ×1.2 后置作用（复用 traits.garrisonMult）
 */

import { t } from '@/i18n'
import type { ResourceType } from './buildings'
import type { TraitId } from './traits'
import { getTrait, DEFAULT_TRAIT_ID } from './traits'
import { STRONGHOLDS } from './pve'

/** 派遣奖励基准据点（与远征里程碑/周强敌同源：silencer_3 奖励包） */
const DISPATCH_BASE_STRONGHOLD = 'silencer_3'

/** 派遣奖励键面：纯资源包（基础包里的遗物概率字段不进派遣奖励） */
const DISPATCH_REWARD_KEYS: ResourceType[] = ['energy', 'crystal', 'alloy', 'data', 'dark']

/** 层缩放系数（与 endless.REWARD_GROWTH 同源；此处独立声明避免 data 层循环依赖） */
const REWARD_GROWTH = 1.35

export interface DispatchTier {
  /** 时长档位（小时） */
  hours: number
  /** 奖励权重（EV 定稿：每小时费率 0.250→0.275→0.300→0.333 单调不减） */
  weight: number
  /** 档位标签（数据实体字段：模块加载时取词，UI 读字段不做动态键拼接） */
  label: string
}

/** 时长档位表（决策点 1/2 定稿，导出供测试与 UI 直读） */
export const DISPATCH_TIERS: DispatchTier[] = [
  { hours: 4, weight: 1.0, label: t('content.dispatch.tier.4') },
  { hours: 8, weight: 2.2, label: t('content.dispatch.tier.8') },
  { hours: 12, weight: 3.6, label: t('content.dispatch.tier.12') },
  { hours: 24, weight: 8.0, label: t('content.dispatch.tier.24') },
]

/** 按小时数查档位（未知时长返回 undefined，入参校验用） */
export function getDispatchTier(hours: number): DispatchTier | undefined {
  return DISPATCH_TIERS.find((tier) => tier.hours === hours)
}

/**
 * 层缩放：1.35^(max(1,best)-1)（endless 同源；best<1 钳 1，防御非有限输入）。
 * expeditionBest 为终身数据（转生保留、hardReset 清零），实时派生不冻结。
 */
export function dispatchRewardScale(best: number): number {
  if (!Number.isFinite(best)) return 1
  return Math.pow(REWARD_GROWTH, Math.max(1, Math.floor(best)) - 1)
}

/** 特性乘区：后勤 doctrine ×1.2（复用 garrisonMult 字段），其余 1.0（含未知 id 回落均衡） */
export function dispatchTraitMult(trait: TraitId | undefined): number {
  return getTrait(trait ?? DEFAULT_TRAIT_ID).garrisonMult
}

export interface DispatchReward {
  energy: number
  crystal: number
  alloy: number
  data: number
  dark: number
}

/**
 * 全额奖励：round(base_v × 1.35^(max(1,best)-1) × w × traitMult)，正数 half-up
 * 与 Math.round 对齐。基准缺失时抛错（静默兜底会退化为零奖励包，配置错误快速失败）。
 */
export function dispatchReward(
  best: number,
  weight: number,
  trait: TraitId | undefined
): DispatchReward {
  const base = STRONGHOLDS.find((s) => s.id === DISPATCH_BASE_STRONGHOLD)
  if (!base) throw new Error(`dispatch: base stronghold missing: ${DISPATCH_BASE_STRONGHOLD}`)
  const rs = dispatchRewardScale(best)
  const m = dispatchTraitMult(trait)
  const out = {} as Record<ResourceType, number>
  for (const key of DISPATCH_REWARD_KEYS) {
    const v = base.rewards[key]
    out[key] = v === undefined ? 0 : Math.round(v * rs * weight * m)
  }
  return out
}

/**
 * 提前召回结算：round(全额 × t/H)（t 钳 [0, H]）；t=H 即全额。
 * 反复短派的小时收益恒为 w/H，不超过最高档费率——召回无套利（EV 核验断言 4）。
 */
export function dispatchRecallReward(
  best: number,
  hours: number,
  weight: number,
  elapsedHours: number,
  trait: TraitId | undefined
): DispatchReward {
  const tier = getDispatchTier(hours)
  const full = dispatchReward(best, tier ? tier.weight : weight, trait)
  const clamped = Math.min(hours, Math.max(0, elapsedHours))
  const ratio = clamped / hours
  const out = {} as Record<ResourceType, number>
  for (const key of DISPATCH_REWARD_KEYS) {
    out[key] = Math.round(full[key] * ratio)
  }
  return out
}

/** 预估奖励（UI 预览用，未取整名义值；与结算同公式，仅不做 round） */
export function dispatchRewardPreview(
  best: number,
  weight: number,
  trait: TraitId | undefined
): DispatchReward {
  const base = STRONGHOLDS.find((s) => s.id === DISPATCH_BASE_STRONGHOLD)
  if (!base) throw new Error(`dispatch: base stronghold missing: ${DISPATCH_BASE_STRONGHOLD}`)
  const rs = dispatchRewardScale(best)
  const m = dispatchTraitMult(trait)
  const out = {} as Record<ResourceType, number>
  for (const key of DISPATCH_REWARD_KEYS) {
    const v = base.rewards[key]
    out[key] = v === undefined ? 0 : v * rs * weight * m
  }
  return out
}
