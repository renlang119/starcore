<script setup lang="ts">
/**
 * AchievementToast.vue — 全局成就解锁提示（v0.57）
 * 消费 achievements store 的 toast 队列：一次展示一条，2.5s 自动消失后
 * shiftToast 取下一条（连续解锁排队展示）。
 * 挂载于 AppShell，所有路由下可见。
 */
import { ref, watch, onUnmounted } from 'vue'
import { useAchievementsStore } from '@/stores/achievements'
import { ACHIEVEMENTS } from '@/data/achievements'

const ach = useAchievementsStore()
const SHOW_MS = 2500

const current = ref<(typeof ACHIEVEMENTS)[number] | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

function showNext() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const toast = ach.toastQueue[0]
  if (!toast) {
    current.value = null
    return
  }
  current.value = ACHIEVEMENTS.find((a) => a.id === toast.id) ?? null
  timer = setTimeout(() => {
    timer = null
    ach.shiftToast()
  }, SHOW_MS)
}

// 队列长度变化即调度下一条（current 非空时说明正在展示，shiftToast 后会再次触发）
watch(() => ach.toastQueue.length, showNext, { immediate: true })
// 展示中一条被消费后 length 变化也会触发 showNext，链式推进

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <transition name="ach-toast">
    <div v-if="current" class="ach-toast" role="status" aria-live="polite">
      <svg class="toast-icon" aria-hidden="true">
        <use href="#i-ui-check" />
      </svg>
      <div class="toast-body">
        <div class="toast-title">成就解锁</div>
        <div class="toast-name">{{ current.name }}</div>
        <div class="toast-reward">{{ current.effects[0]?.label }}</div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.ach-toast {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 400;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-quantum);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 16px color-mix(in srgb, var(--color-quantum) 15%, transparent);
  pointer-events: none;
  max-width: min(320px, calc(100vw - 2 * var(--space-4)));
}
/* 移动端：顶部居中，避开 TopBar 资源条 */
@media (max-width: 767px) {
  .ach-toast {
    top: auto;
    bottom: 96px; /* 底部导航之上 */
    right: var(--space-3);
    left: var(--space-3);
    max-width: none;
  }
}
.toast-icon {
  width: var(--icon-lg);
  height: var(--icon-lg);
  color: var(--color-quantum);
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-quantum) 50%, transparent));
}
.toast-body {
  min-width: 0;
}
.toast-title {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  letter-spacing: 0.1em;
}
.toast-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-t-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast-reward {
  font-size: var(--text-xs);
  color: var(--color-amber);
}

.ach-toast-enter-active,
.ach-toast-leave-active {
  transition:
    opacity 0.25s var(--ease-out),
    transform 0.25s var(--ease-out);
}
.ach-toast-enter-from,
.ach-toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
@media (max-width: 767px) {
  .ach-toast-enter-from,
  .ach-toast-leave-to {
    transform: translateY(12px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ach-toast-enter-active,
  .ach-toast-leave-active {
    transition: opacity 0.15s ease;
  }
  .ach-toast-enter-from,
  .ach-toast-leave-to {
    transform: none;
  }
}
</style>
