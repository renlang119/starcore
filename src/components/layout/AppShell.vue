<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBreakpoint } from '@/composables/useBreakpoint'
import TopBar from './TopBar.vue'
import BottomNav from './BottomNav.vue'
import SideNav from './SideNav.vue'
import OfflineReport from './OfflineReport.vue'
import AchievementToast from './AchievementToast.vue'
import Icons from '@/components/ui/Icons.vue'

const route = useRoute()
const router = useRouter()
const { isDesktop } = useBreakpoint()

/** 宽版内容区：路由 meta.wide 控制（首页双列需要更宽的 max-width） */
const isWideContent = computed(() => route.meta.wide === true)

/** P2-2 星点闪烁 — 背景星点配置（替代 6 个静态 span） */
const stars = [
  {
    top: '18%',
    left: '12%',
    background: 'rgba(255,255,255,.6)',
    size: '2px',
    duration: '3.2s',
    delay: '0s',
  },
  {
    top: '12%',
    left: '78%',
    background: 'rgba(0,229,255,.5)',
    size: '2px',
    duration: '2.8s',
    delay: '-0.7s',
  },
  {
    top: '65%',
    left: '35%',
    background: 'rgba(255,255,255,.4)',
    size: '2px',
    duration: '3.5s',
    delay: '-1.4s',
  },
  {
    top: '78%',
    left: '88%',
    background: 'rgba(167,139,250,.4)',
    size: '2px',
    duration: '3.0s',
    delay: '-2.1s',
  },
  {
    top: '88%',
    left: '22%',
    background: 'rgba(255,255,255,.3)',
    size: '2px',
    duration: '2.5s',
    delay: '-0.5s',
  },
  {
    top: '40%',
    left: '60%',
    background: 'rgba(0,229,255,.3)',
    size: '3px',
    duration: '4.0s',
    delay: '-1.8s',
  },
] as const

/**
 * 战斗页面 (/battle/:id) 不在常规导航中，
 * 移动端需要一个浮动「返回」按钮让玩家回到主界面。
 * 遗物/奇点重启已收入底部导航「更多」菜单，不再需要额外入口。
 */
const showBattleBack = computed(() => route.path.startsWith('/battle'))

// P3-5 路由跃迁白光 overlay 触发控制
const warpFlash = ref(false)
let warpTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => route.path,
  () => {
    // 防抖：新触发先清旧 timer，避免上一次的熄灭回调提前中断本次白光
    if (warpTimer) clearTimeout(warpTimer)
    warpFlash.value = true
    warpTimer = setTimeout(() => {
      warpFlash.value = false
      warpTimer = null
    }, 350)
  }
)
</script>

<template>
  <div class="app-shell">
    <!-- 图标符号表：全应用只挂载一次（v0.77 收敛，消除各视图与成就提示的重复 symbol） -->
    <Icons />

    <!-- P2-2 星点闪烁 -->
    <div class="star-field" aria-hidden="true">
      <span
        v-for="(s, i) in stars"
        :key="i"
        class="star"
        :style="{
          top: s.top,
          left: s.left,
          background: s.background,
          width: s.size,
          height: s.size,
          animationDuration: s.duration,
          animationDelay: s.delay,
        }"
      ></span>
    </div>

    <!-- 侧边导航：通过 useBreakpoint + v-if 控制显隐，避免 CSS 优先级脆弱性 -->
    <SideNav v-if="isDesktop" />

    <!-- 主区域 -->
    <div class="main-area">
      <TopBar />
      <main class="content" :class="{ 'content--wide': isWideContent }">
        <router-view v-slot="{ Component }">
          <transition name="warp" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      <!-- 底部导航：通过 useBreakpoint + v-if 控制显隐 -->
      <BottomNav v-if="!isDesktop" />
    </div>

    <!-- P3-5 路由跃迁白光 overlay -->
    <div v-if="warpFlash" class="warp-overlay" aria-hidden="true"></div>

    <!-- 离线收益弹窗 -->
    <OfflineReport />

    <!-- 成就解锁全局提示（v0.57） -->
    <AchievementToast />

    <!-- 战斗页返回按钮——仅移动端 -->
    <div v-if="showBattleBack && !isDesktop" class="extra-nav">
      <button @click="router.push('/')">返回</button>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.content {
  flex: 1;
  /* 移动端默认样式：底部留出底部导航空间 */
  padding: var(--space-4);
  padding-bottom: 80px; /* 底部导航高度 + 安全距离 */
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
/* 桌面端：无底部导航，padding 恢复正常 */
@media (min-width: 768px) {
  .content {
    padding: var(--space-6);
    padding-bottom: var(--space-6);
  }
}
/* 宽版内容（首页双列）：按 route.meta.wide 加宽，替代视图中失效的 :deep 覆盖（v0.77） */
.content--wide {
  max-width: 720px;
}
@media (min-width: 768px) {
  .content--wide {
    max-width: 1040px;
  }
}
@media (min-width: 1024px) {
  .content--wide {
    max-width: 1280px;
  }
}
@media (min-width: 1440px) {
  .content--wide {
    max-width: 1440px;
  }
}
.extra-nav {
  position: fixed;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  /* display: flex 由 JS v-if 控制显隐，仅移动端渲染 */
  display: flex;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-glow);
  border-radius: var(--radius-pill);
  padding: var(--space-1);
  z-index: 50;
}
.extra-nav button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}

/* P3-5 路由跃迁白光 overlay — 全屏覆盖，350ms 闪过 */
.warp-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(0, 229, 255, 0.1) 30%,
    transparent 70%
  );
  animation: warpFlash 0.35s var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .warp-overlay {
    animation: fadeIn 0.2s ease;
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>
