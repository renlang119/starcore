<script setup lang="ts">
import { t } from '@/i18n'
/**
 * EndlessDepthPanel.vue — 无尽远征深度选择面板（从 BattleView 拆出）。
 *
 * 深度状态由父层持有（跟随前沿 / 手动钳制的调度在调用方），
 * 本组件仅渲染「− / 深度 / ＋」与前沿徽标，类名与 data-testid 不变。
 */
defineProps<{
  /** 当前选择深度 */
  depth: number
  /** 可选深度上限（父层已按 MAX_ENDLESS_DEPTH 钳制的前沿值；常量见 src/data/endless.ts） */
  maxDepth: number
}>()

const emit = defineEmits<{ step: [delta: number] }>()
</script>

<template>
  <div class="endless-depth" data-testid="endless-depth-panel">
    <h3 class="section-title">{{ t('battle.depthTitle') }}</h3>
    <div class="depth-controls">
      <button
        class="depth-btn"
        :disabled="depth <= 1"
        data-testid="endless-depth-minus"
        :aria-label="t('battle.depthDown')"
        @click="emit('step', -1)"
      >
        −
      </button>
      <div class="depth-value font-mono" data-testid="endless-depth-value">
        {{ t('battle.depthLead') }} {{ depth }} {{ t('battle.depthUnit') }}
        <span v-if="depth === maxDepth" class="depth-frontier">{{ t('battle.frontier') }}</span>
      </div>
      <button
        class="depth-btn"
        :disabled="depth >= maxDepth"
        data-testid="endless-depth-plus"
        :aria-label="t('battle.depthUp')"
        @click="emit('step', 1)"
      >
        ＋
      </button>
    </div>
    <p class="depth-hint">{{ t('battle.depthHint') }}</p>
  </div>
</template>

<style scoped>
/* —— 无尽远征深度选择（v0.60）—— */
.endless-depth {
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-plasma) 45%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.depth-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.depth-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-line);
  background: var(--color-surface);
  font-size: var(--text-lg);
  color: var(--color-t-primary);
  flex-shrink: 0;
}
.depth-btn:disabled {
  opacity: 0.35;
}
.depth-value {
  flex: 1;
  text-align: center;
  font-size: var(--text-base);
  color: var(--color-plasma);
}
.depth-frontier {
  display: inline-block;
  margin-left: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-on-core);
  background: var(--color-plasma);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-2);
}
.depth-hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
</style>
