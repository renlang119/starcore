<!-- src/components/ui/CeremonyOverlay.vue -->
<script setup lang="ts">
/**
 * CeremonyOverlay.vue：节点仪式感全屏演出底座（v1.55）
 *
 * 转生（奇点重启）与终局（全宇宙探索完毕）两场景共用：
 * 白光闪场入场（复用 warpFlash 关键帧）+ 居中仪式卡 + 关闭提示。
 * 点击任意处或约 4 秒自动关闭；Escape 同语义。减动效由全局规则
 * 统一降级（闪场与入场动画瞬时完成，仪式卡静态可读）。
 */
import { ref } from 'vue'
import { t } from '@/i18n'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useTimeout } from '@/composables/useTimeout'
import Icon from './Icon.vue'

defineProps<{
  /** 仪式主标题（兼作无障碍标签） */
  title: string
  /** 主题色（取设计令牌值，经 --accent 注入卡片） */
  accent: string
  /** 图标 symbol id */
  icon: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const SHOW_MS = 4000

const cardRef = ref<HTMLElement | null>(null)
useFocusTrap(cardRef, ref(true), { onEscape: () => emit('close') })

const timer = useTimeout()
timer.set(() => emit('close'), SHOW_MS)
</script>

<template>
  <div
    class="ceremony-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @click="emit('close')"
  >
    <div class="ceremony-flash" aria-hidden="true"></div>
    <div ref="cardRef" class="ceremony-card" :style="{ '--accent': accent }">
      <Icon class="ceremony-icon" :name="icon" />
      <h2 class="ceremony-title font-display">{{ title }}</h2>
      <slot />
      <p class="ceremony-hint">{{ t('common.tapToContinue') }}</p>
    </div>
  </div>
</template>

<style scoped>
.ceremony-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #05070d 88%, transparent);
  cursor: pointer;
}
.ceremony-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #ffffff;
  opacity: 0;
  animation: warpFlash 0.35s var(--ease-out);
}
.ceremony-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: min(360px, calc(100vw - 2 * var(--space-4)));
  text-align: center;
  animation: modalIn 0.25s var(--ease-out);
}
.ceremony-icon {
  width: 56px;
  height: 56px;
  color: var(--accent);
  filter: drop-shadow(0 0 16px color-mix(in srgb, var(--accent) 60%, transparent));
}
.ceremony-title {
  font-size: var(--text-2xl);
  font-weight: 900;
  color: var(--accent);
  text-shadow: 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent);
}
.ceremony-hint {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
}
</style>
