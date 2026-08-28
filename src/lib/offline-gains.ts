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
  if (elapsed < 60) return null
  const duration = Math.min(elapsed, OFFLINE_CAP)
  const { totalProduction, offlineMult, garrisoned, garrisonIdleReward, gainResource, advanceTraining } = deps

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
  for (const [strongholdId] of Object.entries(garrisoned)) {
    const idle = garrisonIdleReward(strongholdId)
    for (const [res, v] of Object.entries(idle)) {
      const gained = D(v).times(duration).times(offlineMult)
      if (gained.gt(0)) {
        gainResource(res as ResourceType, gained)
        const existing = garrisonGains[res] ? deser(garrisonGains[res]) : D(0)
        garrisonGains[res] = ser(existing.plus(gained))
      }
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
  if (Math.random() < 0.2 && Object.keys(gains).length > 0) {
    const ev = events[Math.floor(Math.random() * events.length)]
    const evGain = totalProduction[ev.res as keyof typeof totalProduction]?.times(ev.mult).times(offlineMult) ?? D(0)
    if (evGain.gt(0)) {
      gainResource(ev.res as ResourceType, evGain)
      const existing = gains[ev.res] ? deser(gains[ev.res]) : D(0)
      gains[ev.res] = ser(existing.plus(evGain))
    }
  }

  const hasTrained = Object.keys(trainedUnits).length > 0
  const hasGarrison = Object.keys(garrisonGains).length > 0
  return { duration, gains, ...(hasGarrison ? { garrisonGains } : {}), ...(hasTrained ? { trainedUnits } : {}) }
}
