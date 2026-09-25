<script setup lang="ts">
import { t } from '@/i18n'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useToast } from '@/composables/useToast'
import { useTimeout } from '@/composables/useTimeout'
import { resourceRows } from '@/lib/resource-rows'
import { D } from '@/lib/decimal'
import { APP_STARS } from '@/data/app-stars'
import { useGameStore } from '@/stores/game'
import TopBar from './TopBar.vue'
import BottomNav from './BottomNav.vue'
import SideNav from './SideNav.vue'
import OfflineReport from './OfflineReport.vue'
import AchievementToast from './AchievementToast.vue'
import Toast from '@/components/ui/Toast.vue'
import Icons from '@/components/ui/Icons.vue'

const route = useRoute()
const router = useRouter()
const { isDesktop } = useBreakpoint()
const game = useGameStore()

/** 全局轻提示实例（存档失败提醒/遭遇事件提醒等跨路由提示）；暴露给子组件复用单实例 */
const toast = useToast()
// 存档双通道写失败（配额/隐私模式）：跨路由常驻提示，直到下次成功保存清除
watch(
  () => game.saveFailed,
  (failed) => {
    if (failed) toast.show(t('save.storageFull'), 3000)
  }
)

// 遭遇事件触发全局提醒（v1.26 方案 8）：挂起即提示，玩家在其他页面也能感知；
// 点不点由玩家决定（不打断，首页事件卡挂起待处理）。
// 提醒延迟 500ms 且结算时取消：首页点选项后不弹「遭遇事件」提醒、
// 回执文案不被覆盖（结算先清挂起，挂起 watch 的待弹 timer 作废）
let encToastTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => game.encounters.pendingEventId,
  (id) => {
    if (id) encToastTimer = setTimeout(() => toast.show(t('ui.encounter.title'), 2500), 500)
  }
)

// 遭遇事件结算回执（v1.26）：lastResolution 非空即有新结算，呈现并取消待弹提醒
watch(
  () => game.encounters.lastResolution,
  (r) => {
    if (!r) return
    if (encToastTimer) {
      clearTimeout(encToastTimer)
      encToastTimer = null
    }
    const entries = Object.entries(r.rewards) as [string, number][]
    const rows = resourceRows(
      Object.fromEntries(entries.map(([k, v]) => [k, D(v)])),
      game.resources.allMeta
    )
    const changes =
      rows.length === 0
        ? t('ui.encounter.nothing')
        : rows.map((x) => `${x.amount} ${x.name}`).join(' + ')
    toast.show(t('ui.encounter.resolved', { name: r.name, changes }), 3200)
  }
)

/** 宽版内容区：路由 meta.wide 控制（首页双列需要更宽的 max-width） */
const isWideContent = computed(() => route.meta.wide === true)

/** P2-2 星点闪烁 — 背景星点配置（表见 data/app-stars.ts） */
const stars = APP_STARS

/**
 * 战斗页面 (/battle/:id) 不在常规导航中，
 * 移动端需要一个浮动「返回」按钮让玩家回到主界面。
 * 遗物/奇点重启已收入底部导航「更多」菜单，不再需要额外入口。
 */
const showBattleBack = computed(() => route.path.startsWith('/battle'))

// P3-5 路由跃迁白光 overlay 触发控制
const warpFlash = ref(false)
const warpTimer = useTimeout()
watch(
  () => route.path,
  () => {
    // 防抖：新触发先清旧 timer，避免上一次的熄灭回调提前中断本次白光
    warpFlash.value = true
    warpTimer.set(() => {
      warpFlash.value = false
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

    <!-- 全局轻提示（存档失败提醒等） -->
    <Toast :toast="toast" />

    <!-- 战斗页返回按钮——仅移动端 -->
    <div v-if="showBattleBack && !isDesktop" class="extra-nav">
      <button @click="router.push('/')">{{ t('common.back') }}</button>
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
    color-mix(in srgb, var(--color-core) 10%, transparent) 30%,
    transparent 70%
  );
  animation: warpFlash 0.35s var(--ease-out);
}
</style>
