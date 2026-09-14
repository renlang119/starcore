/**
 * offline-gains.ts — 离线收益计算
 *
 * 从 game.ts 中提取，独立计算玩家离线期间的资源收益、
 * 驻扎收益、训练完成等单位。
 */
import { D, deser, ser, type Decimal } from './decimal'
import type { ResourceType } from '@/data/buildings'
import type { UnitId } from '@/data/units'

/** 离线收益上限（秒） */
export const OFFLINE_CAP = 24 * 3600

export interface OfflineReport {
  duration: number
  gains: Record<string, string>
  garrisonGains?: Record<string, string>
  /** 离线随机事件收益（单列区块，不与建筑产出混计） */
  eventGains?: Record<string, string>
  trainedUnits?: Partial<Record<UnitId, number>>
}

export interface OfflineGainsDeps {
  /** 建筑总产出（已含乘数） */
  totalProduction: Record<string, Decimal>
  /** 离线收益乘数 */
  offlineMult: Decimal
  /** 驻扎挂机收益：据点 id → { 资源 → 每秒产出 } */
  garrisoned: Record<string, unknown>
  /** 获取某据点驻扎每秒收益 */
  garrisonIdleReward: (strongholdId: string) => Record<string, number>
  /** 增加资源 */
  gainResource: (res: ResourceType, amount: number | Decimal) => void
  /** 推进训练队列（返回完成的单位） */
  advanceTraining: (duration: number) => Partial<Record<UnitId, number>>
}

/**
 * 计算离线收益
 * @param elapsed 离线秒数
 * @param deps 依赖注入（各 store 的方法/数据）
 * @returns 离线收益报告，或 elapsed < 60 时返回 null
 */
export function computeOfflineGains(elapsed: number, deps: OfflineGainsDeps): OfflineReport | null {
  // 非有限守卫（NaN/Infinity）：NaN < 60 为 false 会穿透门槛，
  // Math.min(NaN, cap) 仍为 NaN，可把训练队列的剩余时间写成 NaN
  // （此后任务永不完成）。公共 lib 契约上自守，不依赖调用方兜底。
  if (!Number.isFinite(elapsed) || elapsed < 60) return null
  const duration = Math.min(elapsed, OFFLINE_CAP)
  const {
    totalProduction,
    offlineMult,
    garrisoned,
    garrisonIdleReward,
    gainResource,
    advanceTraining,
  } = deps

  // 建筑产出
  const gains: Record<string, string> = {}
  for (const [res, v] of Object.entries(totalProduction)) {
    const gained = v.times(duration).times(offlineMult)
    if (gained.gt(0)) {
      gainResource(res as ResourceType, gained)
      gains[res] = ser(gained)
    }
  }

  // 驻扎挂机收益
  const garrisonGains: Record<string, string> = {}
  const garrisonPerSec: Record<string, Decimal> = {}
  for (const [strongholdId] of Object.entries(garrisoned)) {
    const idle = garrisonIdleReward(strongholdId)
    for (const [res, v] of Object.entries(idle)) {
      const gained = D(v).times(duration).times(offlineMult)
      if (gained.gt(0)) {
        gainResource(res as ResourceType, gained)
        const existing = garrisonGains[res] ? deser(garrisonGains[res]) : D(0)
        garrisonGains[res] = ser(existing.plus(gained))
      }
      // 每秒基准（随机事件回退用，与 duration 无关）
      garrisonPerSec[res] = (garrisonPerSec[res] ?? D(0)).plus(v)
    }
  }

  // 训练队列补推进
  const trainedUnits = advanceTraining(duration)

  // 随机事件（20% 概率）
  const events = [
    { msg: '深空探测到能量波动，获得额外能量', res: 'energy', mult: 60 },
    { msg: '捕获漂流的数据碎片', res: 'data', mult: 120 },
    { msg: '陨石带来少量合金', res: 'alloy', mult: 30 },
  ]
  // 事件收益单列区块（不并入建筑产出）：事件基准是每秒产出 × 固定倍数
  // （最多 120 秒产量），与按 duration 计的建筑产出性质不同，混计会让
  // 玩家无从分辨来源；无收益事件产生区块
  const eventGains: Record<string, string> = {}
  // 触发判定并入驻扎产出（v0.78）：纯驻扎挂机无建筑产出时也可摇到事件
  if (
    Math.random() < 0.2 &&
    (Object.keys(gains).length > 0 || Object.keys(garrisonGains).length > 0)
  ) {
    const ev = events[Math.floor(Math.random() * events.length)]
    // 事件基准：建筑产出优先，无建筑产出时回退到驻扎每秒产出
    const buildingBase = totalProduction[ev.res as keyof typeof totalProduction]
    const base = buildingBase?.gt(0) ? buildingBase : (garrisonPerSec[ev.res] ?? D(0))
    const evGain = base.times(ev.mult).times(offlineMult)
    if (evGain.gt(0)) {
      gainResource(ev.res as ResourceType, evGain)
      eventGains[ev.res] = ser(evGain)
    }
  }

  const hasTrained = Object.keys(trainedUnits).length > 0
  const hasGarrison = Object.keys(garrisonGains).length > 0
  const hasEvent = Object.keys(eventGains).length > 0
  return {
    duration,
    gains,
    ...(hasGarrison ? { garrisonGains } : {}),
    ...(hasEvent ? { eventGains } : {}),
    ...(hasTrained ? { trainedUnits } : {}),
  }
}
