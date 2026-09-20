<script setup lang="ts">
/**
 * GarrisonModal.vue — 挂机驻扎确认弹窗（从 BattleView 拆出）。
 *
 * 展示驻扎预期收益（每秒 + 每小时）与说明；确认/取消经事件交回父层。
 * 类名与文案保持不变。
 */
import { t } from '@/i18n'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

defineProps<{
  /** 是否显示弹窗 */
  show: boolean
  /** 据点名称（标题行文案内嵌） */
  strongholdName: string
  /** 收益预览行（每秒 + 每小时） */
  preview: { id: string; name: string; color: string; perSec: string; perHour: string }[]
}>()

const emit = defineEmits<{ cancel: []; confirm: [] }>()
</script>

<template>
  <ConfirmModal
    :model-value="show"
    modal-class="garrison-confirm-modal"
    :aria-label="t('battle.garrisonAria')"
    :confirm-text="t('battle.garrisonConfirm')"
    :confirm-flex="2"
    accent="var(--color-quantum)"
    @cancel="emit('cancel')"
    @confirm="emit('confirm')"
  >
    <h2 class="result-title font-display">{{ t('battle.garrison') }}</h2>
    <p class="result-sub">
      {{ t('battle.garrisonAt') }}「{{ strongholdName }}」{{ t('battle.garrisonDesc') }}
    </p>
    <div class="garrison-rewards">
      <h4>{{ t('battle.garrisonGains') }}</h4>
      <div v-for="r in preview" :key="r.id" class="reward-row">
        <span class="g-reward-name" :style="{ color: r.color }">{{ r.name }}</span>
        <span class="g-reward-rates font-mono">
          <span class="rate-sec">+{{ r.perSec }}/s</span>
          <span class="rate-hour">（{{ r.perHour }}/h）</span>
        </span>
      </div>
      <p class="garrison-hint">{{ t('battle.garrisonNote') }}</p>
    </div>
  </ConfirmModal>
</template>

<style scoped>
:deep(.garrison-confirm-modal) {
  border-color: var(--color-quantum);
  box-shadow: 0 0 40px color-mix(in srgb, var(--color-quantum) 15%, transparent);
}
.result-title {
  font-size: var(--text-xl);
  font-weight: 900;
  text-align: center;
  margin-bottom: var(--space-1);
}
.result-sub {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  text-align: center;
  margin-bottom: var(--space-4);
}
.garrison-rewards {
  margin-bottom: var(--space-4);
}
.garrison-rewards h4 {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.reward-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  font-size: var(--text-sm);
}
.g-reward-name {
  font-size: var(--text-sm);
  font-weight: 500;
}
.g-reward-rates {
  font-size: var(--text-sm);
}
.rate-sec {
  color: var(--color-quantum);
  font-weight: 700;
}
.rate-hour {
  color: var(--color-t-tertiary);
  font-size: var(--text-xs);
}
.garrison-hint {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-top: var(--space-2);
  text-align: center;
}
</style>
