<script setup lang="ts">
// ActionQueuePanel — 首页行动队列（v0.54 从 HomeView 拆出）
// 数据组装逻辑在 useActionQueue，本组件只负责渲染
import { useRouter } from 'vue-router'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import Icon from '@/components/ui/Icon.vue'
import { useActionQueue } from '@/composables/useActionQueue'

defineProps<{
  /** 当前应显示的引导 step（null 表示不显示） */
  activeStep?: string | null
}>()
const emit = defineEmits<{
  dismiss: []
  skip: []
}>()

const router = useRouter()
const { displayActions, hasActions } = useActionQueue()
</script>

<template>
  <!-- 行动队列（P1-2 合并模块，P1-7 背景区分） -->
  <section class="action-queue" aria-labelledby="action-queue-title">
    <h3 id="action-queue-title" class="section-title">行动队列</h3>
    <!-- P3-3 onboarding: 行动队列引导 -->
    <OnboardingBubble
      v-if="activeStep === 'home-actions'"
      class="ob-actions"
      title="行动队列"
      text="这里显示当前正在进行和可执行的操作，点击即可跳转。"
      @dismiss="emit('dismiss')"
      @skip="emit('skip')"
    />
    <ul class="action-list">
      <li
        v-for="item in displayActions"
        :key="item.id"
        class="action-item"
        :class="item.status"
        :style="{ '--c': item.color }"
      >
        <button class="action-btn" @click="router.push(item.path)">
          <!-- in-progress: 纯色图标 -->
          <Icon
            v-if="item.status === 'in-progress'"
            class="action-icon"
            :name="item.icon"
            size="md"
          />
          <!-- actionable: 色块 + 图标 -->
          <div v-else class="action-icon-block">
            <Icon :name="item.icon" size="lg" />
          </div>
          <div class="action-info">
            <span class="action-label">{{ item.label }}</span>
            <span v-if="item.status === 'in-progress'" class="action-detail">{{
              item.detail
            }}</span>
            <span v-else class="action-desc">{{ item.detail }}</span>
          </div>
          <Icon class="action-arrow" name="i-ui-arrow-right" size="sm" />
        </button>
        <!-- 进度条（仅 in-progress） -->
        <ProgressBar
          v-if="item.status === 'in-progress' && item.progress !== undefined"
          class="action-progress"
          fill-class="action-progress-bar"
          :pct="item.progress * 100"
        />
      </li>
    </ul>
    <div v-if="!hasActions" class="action-empty empty-state">
      <span class="empty-text">星核静默中，等待你的指令…</span>
    </div>
  </section>
</template>

<style scoped>
/* —— P1-2 行动队列 —— */
.action-queue {
  background: color-mix(in srgb, var(--color-core) 2%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.action-item {
  width: 100%;
  position: relative;
  overflow: hidden;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  transition: all 0.2s var(--ease-out);
  position: relative;
}

/* —— 进行中（in-progress）—— */
.action-item.in-progress {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--c);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
  animation: actionPulse 2s ease-in-out infinite;
}
.action-item.in-progress .action-icon {
  color: var(--c);
  flex-shrink: 0;
}
.action-item.in-progress .action-info {
  flex: 1;
  text-align: left;
  min-width: 0;
}
.action-item.in-progress .action-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-t-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-item.in-progress .action-detail {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-item.in-progress .action-arrow {
  color: var(--color-t-tertiary);
  flex-shrink: 0;
}
.action-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  --pb-h: 2px;
  --pb-radius: 0;
  --pb-fill: var(--c);
  --pb-fill-radius: 0 2px 2px 0;
  --pb-transition: width 0.5s var(--ease-out);
  --pb-glow: 0 0 4px var(--c);
  --pb-overflow: visible;
}

/* —— 可执行（actionable）—— */
.action-item.actionable {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  transition: all 0.2s var(--ease-out);
}
.action-item.actionable:hover {
  transform: translateY(-2px); /* P2-4 */
  background: var(--color-hover);
  border-color: var(--color-border-glow);
  box-shadow:
    var(--elevation-2),
    /* P2-6 */ 0 0 0 1px color-mix(in srgb, var(--c) 20%, transparent);
}
.action-item.actionable:active {
  transform: translateY(0) scale(0.98); /* P2-4：卡片回弹与卡片统一 */
  transition: transform 0.1s var(--ease-out); /* P2-4：active 回弹 0.1s 与 ov-item 对齐 */
}
.action-item.actionable .action-icon-block {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--c) 15%, transparent);
  color: var(--c);
  flex-shrink: 0;
}
.action-item.actionable .action-info {
  flex: 1;
  text-align: left;
}
.action-item.actionable .action-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-t-primary);
}
.action-item.actionable .action-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-top: var(--space-1);
  display: block;
}
.action-item.actionable .action-arrow {
  color: var(--color-t-tertiary);
  flex-shrink: 0;
  opacity: 0;
  transition:
    opacity 0.2s var(--ease-out),
    transform 0.2s var(--ease-out);
}
.action-item.actionable:hover .action-arrow {
  opacity: 1;
  transform: translateX(2px);
}

/* 空状态 */
.action-empty {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--color-t-tertiary);
  font-size: var(--text-sm);
}

/* P1-2 桌面端适配 */
@media (min-width: 768px) {
  .action-list {
    gap: var(--space-3);
  }
}

/* —— P3-3 onboarding 气泡定位（变体类承载定位与层级，v0.97）—— */
.ob-actions {
  position: relative;
  width: 100%;
  margin-bottom: var(--space-3);
  z-index: 60;
}
</style>
