<script setup lang="ts">
// QuickActions — 首页快速操作入口（v0.54 从 HomeView 拆出）
import { useRouter } from 'vue-router'
import { NAV_ITEMS } from '@/data/navigation'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import Icon from '@/components/ui/Icon.vue'

defineProps<{
  /** 当前应显示的引导 step（null 表示不显示） */
  activeStep?: string | null
}>()
const emit = defineEmits<{
  dismiss: []
  skip: []
}>()

const router = useRouter()

// P3-2 快速操作入口：按 id 白名单从 NAV_ITEMS 派生（图标/路径同源），入口色为首页专属映射
const QUICK_ENTRIES: { id: string; color: string; label?: string }[] = [
  { id: 'build', color: 'var(--color-core)' },
  // 「科技树」在首页入口沿用既有「科技」文案（v0.54 起口径，避免可见文案变化）
  { id: 'tech', color: 'var(--color-plasma)', label: '科技' },
  { id: 'map', color: 'var(--color-quantum)' },
  { id: 'army', color: 'var(--color-alert)' },
]
const quickActions = QUICK_ENTRIES.map(({ id, color, label }) => {
  const item = NAV_ITEMS.find((n) => n.id === id)!
  return { ...item, color, label: label ?? item.label }
})
</script>

<template>
  <!-- P3-2 快速操作入口 — Hero 下方一行 4 个等宽紧凑按钮 -->
  <section class="quick-actions" aria-label="快速操作">
    <!-- P3-3 onboarding: 快速操作引导 -->
    <OnboardingBubble
      v-if="activeStep === 'home-quick'"
      class="ob-quick"
      title="快速操作"
      text="点击下方按钮可快速进入建造、科技、探索、部队页面。"
      @dismiss="emit('dismiss')"
      @skip="emit('skip')"
    />
    <button
      v-for="action in quickActions"
      :key="action.id"
      class="quick-action-btn btn-secondary sm"
      :style="{ '--c': action.color }"
      @click="router.push(action.path)"
    >
      <Icon :name="action.icon" size="md" />
      <span>{{ action.label }}</span>
    </button>
  </section>
</template>

<style scoped>
/* —— P3-2 快速操作入口 —— */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  position: relative;
}
.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-t-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  transition: all 0.15s var(--ease-out);
  cursor: pointer;
}
.quick-action-btn svg {
  color: var(--c, var(--color-t-secondary));
}
.quick-action-btn:hover {
  border-color: var(--c, var(--color-core));
  color: var(--color-t-primary);
  background: var(--color-elevated);
}
.quick-action-btn:active {
  transform: scale(0.95);
}

/* —— P3-3 onboarding 气泡定位（变体类承载定位与层级，v0.97）—— */
.ob-quick {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: min(260px, 80vw);
  margin-bottom: var(--space-2);
  z-index: 60;
}
</style>
