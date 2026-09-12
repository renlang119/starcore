<script setup lang="ts">
import { computed, ref } from 'vue'
import { RARITY_INFO, MAX_RELIC_LEVEL, ENHANCE_GAIN, enhanceLabel } from '@/data/relics'
import type { RelicEffect } from '@/data/relics'
import { enhancedEffectsOf, type OwnedRelic } from '@/stores/relics'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'

/**
 * EnhanceModal — 遗物强化弹窗（自 RelicView 拆出，v0.72）
 *
 * 强化状态（选中遗物/成本/预览/执行）全部内聚在本组件；
 * 能量不足等提示通过 fail 事件交由视图层 toast（不自带 toast 实现）。
 * data-testid 与 DOM 结构与拆分前一致，供单测与 Playwright 脚本断言。
 */
const props = defineProps<{ relic: OwnedRelic }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'fail', msg: string): void }>()

const game = useGameStore()

/** 下一级成本（能量）；满级/不存在返回 null */
const nextCost = computed<number | null>(() =>
  props.relic ? game.relics.nextEnhanceCost(props.relic.instanceId) : null
)
/** 一级都买不起时禁用（与建造/转生批量口径一致；批量中预算耗尽仍走 fail toast） */
const canAffordOne = computed(() =>
  nextCost.value !== null ? game.resources.canAfford({ energy: nextCost.value }) : false
)
const isMax = computed(() => (props.relic?.level ?? 0) >= MAX_RELIC_LEVEL)
/** 强化后效果（当前级） */
const currentEffects = computed<RelicEffect[]>(() =>
  props.relic ? enhancedEffectsOf(props.relic) : []
)
/** 下一级效果预览（升到 level+1 的 label） */
const nextEffects = computed<{ label: string; next: string }[]>(() => {
  const r = props.relic
  if (!r || isMax.value) return []
  return r.effects.map((eff) => {
    const gain = ENHANCE_GAIN[eff.type]
    if (!gain) return { label: eff.label, next: eff.label }
    return { label: eff.label, next: enhanceLabel(eff.label, eff.value, gain, r.level + 1) }
  })
})

function doEnhance() {
  if (!props.relic) return
  const done = game.relics.enhanceSteps(props.relic.instanceId, bulkSteps.value)
  if (!done) emit('fail', '能量不足')
}

// v0.86 批量强化段位（默认 ×1 与既有行为一致；封顶 20 级，×100 可一键拉满）
const bulkSteps = ref(1)

function rarityColor(rarity: string): string {
  return RARITY_INFO[rarity as keyof typeof RARITY_INFO]?.color ?? '#fff'
}
</script>

<template>
  <ModalOverlay
    :model-value="true"
    modal-class="enhance-modal"
    aria-label="遗物强化"
    @overlay-click="emit('close')"
  >
    <template v-if="relic">
      <h2 class="result-title font-display">遗物强化</h2>
      <div
        class="synth-product"
        :style="{ '--c': rarityColor(relic.rarity) }"
        data-testid="enhance-modal"
      >
        <div class="r-head">
          <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
            <use :href="'#' + relic.icon" />
          </svg>
          <span class="rarity-badge" :style="{ background: rarityColor(relic.rarity) }">
            {{ RARITY_INFO[relic.rarity].name }}
          </span>
        </div>
        <div class="r-name">{{ relic.name }}</div>
        <div class="enhance-level" data-testid="enhance-level">
          等级：{{ relic.level }} / {{ MAX_RELIC_LEVEL }}
        </div>
        <div class="r-effects">
          <span v-for="(e, i) in currentEffects" :key="i" class="eff-mini">{{ e.label }}</span>
        </div>
        <div v-if="!isMax && nextEffects.length > 0" class="enhance-preview">
          <div v-for="(p, i) in nextEffects" :key="i" class="preview-row">
            <span class="preview-from">{{ p.label }}</span>
            <span class="preview-arrow">→</span>
            <span class="preview-to">{{ p.next }}</span>
          </div>
        </div>
        <div v-if="isMax" class="enhance-max">已达上限</div>
        <div v-else class="enhance-cost-row" data-testid="enhance-cost">
          下一级消耗：<span class="font-mono">{{ fmt(nextCost ?? 0) }}</span> 能量
        </div>
      </div>
      <div class="btn-group">
        <div v-if="!isMax" class="enhance-actions">
          <div class="bulk-toggle" role="group" aria-label="单次强化级数">
            <button
              v-for="s in [1, 10, 100]"
              :key="s"
              class="seg-btn"
              :class="{ active: bulkSteps === s }"
              @click="bulkSteps = s"
            >
              ×{{ s }}
            </button>
          </div>
          <button
            class="btn-primary"
            style="flex: 1"
            data-testid="enhance-confirm"
            :disabled="!canAffordOne"
            @click="doEnhance"
          >
            {{ bulkSteps > 1 ? `强化 ×${bulkSteps}` : '强化' }}
          </button>
        </div>
        <button
          v-if="!isMax"
          class="btn-ghost"
          style="flex: 1"
          data-testid="enhance-close"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
    </template>
  </ModalOverlay>
</template>

<style scoped>
/* 弹窗内容样式自 RelicView 原样迁入（.enhance-modal 是 ModalOverlay 根节点上的 class，
   scoped 规则匹配不到它，与拆分前实际生效范围一致。
   标题原无专属配色（plasma 色是 synth-modal 专属），故此处 .result-title 不设色） */
.r-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
  color: var(--c);
}
.rarity-badge {
  font-size: var(--text-xs);
  padding: 1px var(--space-2);
  border-radius: 3px;
  color: var(--color-void);
  font-weight: 700;
}
.r-name {
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: var(--space-1);
}
.r-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.eff-mini {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: var(--color-elevated);
  border-radius: 3px;
  color: var(--color-t-primary);
}
.synth-product {
  border: 1px solid var(--c);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c) 8%, var(--color-surface));
  padding: var(--space-3);
  margin: var(--space-3) 0;
}
.enhance-level {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
  margin: var(--space-1) 0;
}
.enhance-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: var(--space-2) 0;
}
.preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}
.preview-from {
  color: var(--color-t-tertiary);
  text-decoration: line-through;
}
.preview-arrow {
  color: var(--color-t-tertiary);
}
.preview-to {
  color: var(--color-amber);
  font-weight: 600;
}
.enhance-max {
  font-size: var(--text-sm);
  color: var(--color-amber);
  font-weight: 600;
  margin: var(--space-2) 0;
}
.enhance-cost-row {
  font-size: var(--text-sm);
  color: var(--color-core);
  margin: var(--space-2) 0;
}
/* v0.86 批量强化段位切换器（×1/×10/×100 三档，封顶 20 级） */
.enhance-actions {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
  flex: 1;
}
.bulk-toggle {
  display: inline-flex;
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.seg-btn {
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
  font-family: var(--font-mono, monospace);
  color: var(--color-t-secondary);
  background: transparent;
  transition: all 0.15s var(--ease-out);
}
.seg-btn + .seg-btn {
  border-left: 1px solid var(--color-border-line);
}
.seg-btn:hover {
  color: var(--color-t-primary);
  background: var(--color-hover);
}
.seg-btn.active {
  color: var(--color-core);
  background: rgba(0, 229, 255, 0.1);
}
</style>
