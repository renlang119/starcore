<script setup lang="ts">
import { t } from '@/i18n'
/**
 * OnboardingBubble.vue：新手引导气泡
 *
 * 视觉：elevated 底 + core 描边 + elevation-2 阴影
 * 动画：floatUp 入场
 * 契约：根节点不携带 position/z-index，定位与层级由父级
 *       .ob-* 变体类承载（z-index 60，与弹窗层级约定一致）
 */
defineProps<{
  /** 气泡标题 */
  title?: string
  /** 气泡内容 */
  text: string
}>()

const emit = defineEmits<{
  dismiss: []
  skip: []
}>()
</script>

<template>
  <div class="onboard-bubble" role="dialog" aria-live="polite">
    <div v-if="title" class="onboard-title">{{ title }}</div>
    <p class="onboard-text">{{ text }}</p>
    <div class="onboard-actions">
      <button class="onboard-skip" @click="emit('skip')">{{ t('ui.skipOnboarding') }}</button>
      <button class="onboard-ok btn-secondary sm" @click="emit('dismiss')">
        {{ t('ui.gotIt') }}
      </button>
    </div>
    <!-- 尾巴指向目标元素 -->
    <span class="onboard-tail" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.onboard-bubble {
  background: var(--color-elevated);
  border: 1px solid var(--color-core);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  padding: var(--space-3) var(--space-4);
  max-width: 260px;
  animation: floatUp 0.3s var(--ease-out);
}
.onboard-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-core);
  margin-bottom: var(--space-1);
}
.onboard-text {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-3);
}
.onboard-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}
.onboard-skip {
  font-size: var(--text-xs);
  line-height: 1.5; /* v1.44：显式行高，英文系统字体行盒偏矮致命中高不足 40px */
  /* v1.38 对比度：tertiary 4.30 → secondary 5.30；命中区经内边距扩展至 ≥40px（负外边距保持视觉不变） */
  color: var(--color-t-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: var(--space-3) var(--space-1);
  margin: calc(-1 * var(--space-3)) calc(-1 * var(--space-1));
}
.onboard-skip:hover {
  color: var(--color-t-primary);
}
.onboard-ok {
  /* 沿用 btn-secondary.sm，额外加 core 描边 */
  border-color: var(--color-core);
  color: var(--color-core);
}

/* 尾巴：默认朝下 */
.onboard-tail {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: var(--color-elevated);
  border-right: 1px solid var(--color-core);
  border-bottom: 1px solid var(--color-core);
}
</style>
