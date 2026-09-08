<script setup lang="ts">
// HomeView — 首页编排（v0.54 起瘦身为组件编排）
// 四个板块实现见 components/home/；行动队列数据组装见 composables/useActionQueue
import HeroCore from '@/components/home/HeroCore.vue'
import ActionQueuePanel from '@/components/home/ActionQueuePanel.vue'
import QuickActions from '@/components/home/QuickActions.vue'
import OverviewPanel from '@/components/home/OverviewPanel.vue'
import DailyCard from '@/components/home/DailyCard.vue'
import { useOnboarding } from '@/composables/useOnboarding'

// P3-3 新手引导（HomeView 3 步）
const { activeStep, dismiss, skipAll } = useOnboarding('home', [
  'home-core',
  'home-quick',
  'home-actions',
])
</script>

<template>
  <div class="home">
    <!-- 上部行：Hero + 行动队列并排（桌面）/ 堆叠（移动） -->
    <div class="home-top-row">
      <HeroCore :active-step="activeStep" @dismiss="dismiss" @skip="skipAll" />
      <ActionQueuePanel :active-step="activeStep" @dismiss="dismiss" @skip="skipAll" />
    </div>

    <QuickActions :active-step="activeStep" @dismiss="dismiss" @skip="skipAll" />
    <DailyCard />
    <OverviewPanel />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: screenIn 0.4s var(--ease-out);
}

/* —— P1-3 桌面端双列布局 —— */
/* 内容区宽度由 AppShell 按 route.meta.wide 加宽（v0.77），本视图只管内部布局 */
.home-top-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
@media (min-width: 768px) {
  .home {
    gap: var(--space-6);
  }
  .home-top-row {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: var(--space-6);
    align-items: start;
  }
  .home-top-row .hero {
    position: sticky;
    top: var(--space-6);
  }
}

/* —— P3-4 四档响应断点 —— */
/* L 断点（1024-1439px）：双列比 38/62 */
@media (min-width: 1024px) {
  .home-top-row {
    grid-template-columns: 38% 62%;
  }
}
/* XL 断点（≥1440px）：双列比 33/67 */
@media (min-width: 1440px) {
  .home-top-row {
    grid-template-columns: 33% 67%;
  }
}
</style>
