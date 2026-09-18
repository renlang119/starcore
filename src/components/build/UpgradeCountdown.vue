<script setup lang="ts">
/**
 * UpgradeCountdown.vue — 建筑升级倒计时组件
 *
 * 基于木桶原理计算建筑升级所需资源的预估时间。
 * 渐进式披露：默认显示倒计时文字+色点，hover/点击展开明细面板。
 *
 * 5 种显示情况：
 *   A. 全满 → 不渲染
 *   B. 仅可产出瓶颈 → 倒计时文字
 *   C. 混合瓶颈 → 倒计时 + 需手动获取
 *   D. 仅手动瓶颈 → 需手动获取
 *   E. 空成本 → 不渲染
 */
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { D, Decimal } from '@/lib/decimal'
import { fmt } from '@/lib/format'
import { getBuilding, type ResourceType } from '@/data/buildings'

const props = defineProps<{
  buildingId: string
}>()

const game = useGameStore()
const expanded = ref(false)

// —— 类型定义 ——
interface ResourceResult {
  resType: ResourceType
  need: number
  have: Decimal
  rate: Decimal
  deficit: Decimal
  status: 'sufficient' | 'producible' | 'manual'
  etaSeconds: number | null
}

interface CountdownResult {
  type: 'none' | 'ready' | 'countdown' | 'manual'
  etaSeconds?: number
  bottleneckResource?: ResourceType
  bottleneckName?: string
  resources: ResourceResult[]
  hasManual?: boolean
  manualResources?: ResourceResult[]
}

// —— 核心计算逻辑 ——
const result = computed<CountdownResult>(() => {
  const def = getBuilding(props.buildingId)
  if (!def) return { type: 'none', resources: [] }

  const cost = game.buildings.getCost(props.buildingId)
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

// —— 辅助函数 ——

/** 秒 → 中文时长格式（<1分钟 / X分钟 / X小时Y分钟 / X天Y小时 / X天） */
function fmtDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return ''
  if (seconds < 60) return '<1分钟'
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}分钟`
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h < 24) return remM > 0 ? `${h}小时${remM}分钟` : `${h}小时`
  const d = Math.floor(h / 24)
  const remH = h % 24
  if (d < 30) return remH > 0 ? `${d}天${remH}小时` : `${d}天`
  return `${d}天`
}

// —— 倒计时时间部分（用于模板分段渲染）——
const timePart = computed(() => {
  if (result.value.type !== 'countdown') return ''
  return fmtDuration(result.value.etaSeconds!)
})

const bottleneckColor = computed(() => {
  if (result.value.type === 'countdown' && result.value.bottleneckResource) {
    return game.resources.getMeta(result.value.bottleneckResource).color
  }
  return ''
})

/**
 * 倒计时行描述（四种形态收敛为数据驱动）：kind 决定色点与文案，
 * hint 决定是否带「明细」入口（混合态第二行无入口）。
 */
const rows = computed(() => {
  const r = result.value
  if (r.type === 'countdown' && r.hasManual) {
    return [
      { key: 'countdown', kind: 'countdown' as const, hint: true },
      { key: 'manual', kind: 'manual' as const, hint: false },
    ]
  }
  if (r.type === 'countdown') return [{ key: 'countdown', kind: 'countdown' as const, hint: true }]
  if (r.type === 'manual') return [{ key: 'manual', kind: 'manual' as const, hint: true }]
  return []
})

// —— 辅助函数 ——
function resColor(rt: ResourceType): string {
  return game.resources.getMeta(rt).color
}

function fmtEta(r: ResourceResult): string {
  if (r.status === 'sufficient') return '已满足'
  if (r.status === 'manual') return '—'
  return fmtDuration(r.etaSeconds!)
}

function fmtRateStr(r: ResourceResult): string {
  if (r.rate.gt(0)) return `+${fmt(r.rate)} /s`
  return '0 /s'
}

function isBottleneck(r: ResourceResult): boolean {
  return result.value.type === 'countdown' && r.resType === result.value.bottleneckResource
}

function toggleExpand() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div v-if="result.type === 'countdown' || result.type === 'manual'" class="countdown-zone">
    <!-- 倒计时行（v-for 数据驱动，四种形态共用一份行体；混合态两行并列） -->
    <div
      v-for="row in rows"
      :key="row.key"
      class="countdown-row"
      :class="{ 'rate-zero': row.kind === 'manual' }"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="
        row.kind === 'countdown' ? '资源预估倒计时，点击查看明细' : '需手动获取的资源，点击查看明细'
      "
      @click="toggleExpand"
      @keydown.enter="toggleExpand"
      @keydown.space.prevent="toggleExpand"
    >
      <span
        v-if="row.kind === 'countdown'"
        class="res-dot"
        :style="{ background: bottleneckColor, color: bottleneckColor }"
      ></span>
      <span v-else class="res-dot"></span>
      <span class="countdown-text">
        <template v-if="row.kind === 'countdown'">
          <span class="cd-prefix">约</span><span class="cd-time">{{ timePart }}</span
          ><span class="cd-prefix">后可升级</span>
        </template>
        <template v-else>
          <span class="cd-time">需手动获取</span>
        </template>
      </span>
      <span v-if="row.hint" class="cd-hint">
        明细
        <svg
          class="cd-arrow"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </div>

    <!-- 展开面板 -->
    <transition name="cd-expand">
      <div v-if="expanded" class="countdown-detail">
        <div class="countdown-detail-inner">
          <div class="detail-title">资源明细</div>

          <div
            v-for="r in result.resources"
            :key="r.resType"
            class="detail-row"
            :class="{ bottleneck: isBottleneck(r) }"
          >
            <span
              class="d-dot"
              :style="{
                background: resColor(r.resType),
                ...(r.status === 'manual' ? { border: `1px dashed ${resColor(r.resType)}` } : {}),
              }"
            ></span>
            <span class="d-name">{{ game.resources.getMeta(r.resType).name }}</span>
            <span class="d-amount">
              <span class="d-current">{{ fmt(r.have) }}</span
              ><span class="d-sep">/</span><span class="d-need">{{ fmt(r.need) }}</span>
            </span>
            <span class="d-rate" :class="{ zero: r.status === 'manual' }">{{ fmtRateStr(r) }}</span>
            <span class="d-eta">{{ fmtEta(r) }}</span>
            <span
              class="d-status"
              :class="
                r.status === 'sufficient'
                  ? 'ok'
                  : isBottleneck(r)
                    ? 'bottleneck'
                    : r.status === 'manual'
                      ? 'manual'
                      : ''
              "
            >
              <template v-if="r.status === 'sufficient'">✓</template>
              <template v-else-if="isBottleneck(r)">瓶颈</template>
              <template v-else-if="r.status === 'manual'">需手动获取</template>
            </span>
          </div>

          <div class="detail-disclaimer">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            基于当前生产速率预估，实际时间可能因速率变化而偏移
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.countdown-zone {
  margin-bottom: var(--space-3);
  position: relative;
}

/* —— 倒计时行 —— */
.countdown-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-line);
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
  user-select: none;
}
.countdown-row:hover {
  border-color: var(--color-border-glow);
  background: var(--color-hover);
}
.countdown-row:focus-visible {
  outline: 2px solid var(--color-core);
  outline-offset: 2px; /* 全局焦点偏移统一 */
}

/* 色点 */
.res-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

/* 倒计时文字 */
.countdown-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-t-secondary);
  white-space: nowrap;
}
.countdown-text .cd-prefix {
  color: var(--color-t-tertiary);
}
.countdown-text .cd-time {
  color: var(--color-t-primary);
}

/* 展开提示 */
.cd-hint {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  transition: transform 0.2s var(--ease-out);
}
.countdown-row[aria-expanded='true'] .cd-hint .cd-arrow {
  transform: rotate(180deg);
}

/* —— rate=0 状态 —— */
.countdown-row.rate-zero {
  background: color-mix(in srgb, var(--color-amber) 6%, transparent);
  border-color: color-mix(in srgb, var(--color-amber) 25%, transparent);
}
.countdown-row.rate-zero .res-dot {
  background: var(--color-amber);
  color: var(--color-amber);
  border: 1px dashed color-mix(in srgb, var(--color-amber) 50%, transparent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--color-amber) 30%, transparent);
}
.countdown-row.rate-zero .countdown-text {
  color: var(--color-amber);
}
.countdown-row.rate-zero .countdown-text .cd-time {
  color: var(--color-amber);
}

/* —— 混合态两行间距（行体收敛后以相邻兄弟边距表达） —— */
.countdown-row + .countdown-row {
  margin-top: var(--space-1);
}

/* —— 展开面板 —— */
.countdown-detail {
  overflow: hidden;
  animation: cdIn 0.25s var(--ease-out);
}
@keyframes cdIn {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}
.countdown-detail-inner {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--color-elevated);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
}

.detail-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-t-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-2);
}

/* 资源明细行 */
.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-line);
  font-size: var(--text-xs);
}
.detail-row:nth-last-child(2) {
  border-bottom: none; /* 容器末位恒为 disclaimer，倒数第二才是末行明细 */
}
.detail-row.bottleneck {
  background: color-mix(in srgb, var(--color-amber) 6%, transparent);
  margin: 0 calc(-1 * var(--space-2));
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border-bottom: none;
}
.detail-row .d-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.detail-row .d-name {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  min-width: 48px;
}
.detail-row .d-amount {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-t-primary);
  flex: 1;
}
.detail-row .d-amount .d-current {
  color: var(--color-t-secondary);
}
.detail-row .d-amount .d-sep {
  color: var(--color-t-tertiary);
  margin: 0 var(--space-1);
}
.detail-row .d-amount .d-need {
  color: var(--color-t-primary);
}
.detail-row .d-rate {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-quantum);
}
.detail-row .d-rate.zero {
  color: var(--color-amber);
}
.detail-row .d-eta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  min-width: 56px;
  text-align: right;
}
.detail-row .d-status {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
.d-status.ok {
  background: color-mix(in srgb, var(--color-quantum) 12%, transparent);
  color: var(--color-quantum);
}
.d-status.bottleneck {
  background: color-mix(in srgb, var(--color-amber) 12%, transparent);
  color: var(--color-amber);
}
.d-status.manual {
  background: color-mix(in srgb, var(--color-amber) 12%, transparent);
  color: var(--color-amber);
}

/* 预估声明 */
.detail-disclaimer {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  line-height: 1.4;
}

/* transition */
.cd-expand-enter-active,
.cd-expand-leave-active {
  transition:
    opacity 0.2s var(--ease-out),
    max-height 0.25s var(--ease-out);
  overflow: hidden;
}
.cd-expand-enter-from,
.cd-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.cd-expand-enter-to,
.cd-expand-leave-from {
  max-height: 500px;
}
</style>
