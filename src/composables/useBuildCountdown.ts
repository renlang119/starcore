/**
 * useBuildCountdown.ts — 建筑升级倒计时预估（木桶原理）。
 *
 * 从 UpgradeCountdown 组件拆出：逐项判定资源缺口，可产出资源按
 * 「缺口 ÷ 生产速率」取最长者作为瓶颈；区分可产出 / 需手动获取
 * 两类状态，五种显示形态由 type 收敛（none / ready / countdown /
 * manual）。纯派生逻辑，无副作用。
 */
import { t } from '@/i18n'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useGameStore } from '@/stores/game'
import { D, Decimal } from '@/lib/decimal'
import { getBuilding, type ResourceType } from '@/data/buildings'

export interface ResourceResult {
  resType: ResourceType
  need: number
  have: Decimal
  rate: Decimal
  deficit: Decimal
  status: 'sufficient' | 'producible' | 'manual'
  etaSeconds: number | null
}

export interface CountdownResult {
  type: 'none' | 'ready' | 'countdown' | 'manual'
  etaSeconds?: number
  bottleneckResource?: ResourceType
  bottleneckName?: string
  resources: ResourceResult[]
  hasManual?: boolean
  manualResources?: ResourceResult[]
}

/** 秒 → 中文时长格式（<1分钟 / X分钟 / X小时Y分钟 / X天Y小时 / X天） */
export function fmtDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return ''
  if (seconds < 60) return t('build.ltMinute')
  const m = Math.floor(seconds / 60)
  if (m < 60) return t('build.minutes', { m: m })
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h < 24)
    return remM > 0 ? t('build.hoursMinutes', { h: h, remM: remM }) : t('build.hours', { h: h })
  const d = Math.floor(h / 24)
  const remH = h % 24
  if (d < 30)
    return remH > 0 ? t('build.daysHours', { d: d, remH: remH }) : t('build.days', { d: d })
  return t('build.days', { d: d })
}

export function useBuildCountdown(getBuildingId: () => string): {
  result: ComputedRef<CountdownResult>
} {
  const game = useGameStore()

  const result = computed<CountdownResult>(() => {
    const def = getBuilding(getBuildingId())
    if (!def) return { type: 'none', resources: [] }

    const cost = game.buildings.getCost(getBuildingId())
    if (Object.keys(cost).length === 0) return { type: 'none', resources: [] }

    const resourceResults: ResourceResult[] = []
    for (const [resType, need] of Object.entries(cost)) {
      if (need <= 0) continue
      const rt = resType as ResourceType
      const have = game.resources.getAmount(rt)
      const rate = game.resources.getRate(rt)
      const deficit = Decimal.max(D(need).minus(have), D(0))

      if (deficit.lte(0)) {
        resourceResults.push({
          resType: rt,
          need,
          have,
          rate,
          deficit: D(0),
          status: 'sufficient',
          etaSeconds: 0,
        })
      } else if (rate.gt(0)) {
        const eta = deficit.div(rate).toNumber()
        // 防御性：Infinity / NaN 视为 manual
        if (!isFinite(eta) || eta < 0) {
          resourceResults.push({
            resType: rt,
            need,
            have,
            rate,
            deficit,
            status: 'manual',
            etaSeconds: null,
          })
        } else {
          resourceResults.push({
            resType: rt,
            need,
            have,
            rate,
            deficit,
            status: 'producible',
            etaSeconds: eta,
          })
        }
      } else {
        resourceResults.push({
          resType: rt,
          need,
          have,
          rate,
          deficit,
          status: 'manual',
          etaSeconds: null,
        })
      }
    }

    // 所有资源为空（need <= 0 全部跳过）
    if (resourceResults.length === 0) return { type: 'none', resources: [] }

    const producible = resourceResults.filter((r) => r.status === 'producible')
    const manual = resourceResults.filter((r) => r.status === 'manual')
    const allSufficient = resourceResults.every((r) => r.status === 'sufficient')

    // 情况 A：资源全满
    if (allSufficient) {
      return { type: 'ready', resources: resourceResults }
    }

    // 情况 D：仅手动瓶颈（无可产出资源缺口）
    if (producible.length === 0 && manual.length > 0) {
      return {
        type: 'manual',
        resources: resourceResults,
        manualResources: manual,
      }
    }

    // 情况 B/C：有可产出瓶颈
    if (producible.length > 0) {
      let bottleneck = producible[0]
      for (const r of producible) {
        if (r.etaSeconds! > bottleneck.etaSeconds!) bottleneck = r
      }
      return {
        type: 'countdown',
        etaSeconds: bottleneck.etaSeconds ?? 0,
        bottleneckResource: bottleneck.resType,
        bottleneckName: game.resources.getMeta(bottleneck.resType).name,
        resources: resourceResults,
        hasManual: manual.length > 0,
        manualResources: manual,
      }
    }

    return { type: 'none', resources: [] }
  })

  return { result }
}
