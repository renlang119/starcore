<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { NAV_ITEMS } from '@/data/navigation'

const route = useRoute()
const router = useRouter()

/** 主导航项（常驻底部导航栏） */
const primaryTabs = NAV_ITEMS.filter((n) => n.tier === 'primary')
/** 次级导航项（收入「更多」菜单） */
const secondaryTabs = NAV_ITEMS.filter((n) => n.tier === 'secondary')

const moreOpen = ref(false)

/** 非导航路由（如战斗页）返回 undefined：不高亮、不打 aria-current（v0.95） */
const activeId = computed(() => {
  const all = [...primaryTabs, ...secondaryTabs]
  return all.find((t) => t.path === route.path)?.id
})

/** 「更多」按钮是否高亮（当前处于次级页面时） */
const moreActive = computed(() => secondaryTabs.some((t) => t.path === route.path))

function nav(path: string) {
  router.push(path)
}

function toggleMore() {
  moreOpen.value = !moreOpen.value
}

function navSecondary(path: string) {
  moreOpen.value = false
  router.push(path)
}

/** 路由变化时自动收起「更多」面板 */
watch(
  () => route.path,
  () => {
    moreOpen.value = false
  }
)

/**
 * 点击面板外部关闭——监听 document 点击事件，
 * 若点击源不在底部导航容器内则收起。
 */
const rootEl = ref<HTMLElement | null>(null)
const moreBtnEl = ref<HTMLElement | null>(null)
function handleDocClick(e: MouseEvent) {
  if (moreOpen.value && rootEl.value && !rootEl.value.contains(e.target as Node)) {
    moreOpen.value = false
  }
}
/** Escape 关闭「更多」面板，并把焦点还给触发按钮（v0.95） */
function handleDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && moreOpen.value) {
    moreOpen.value = false
    moreBtnEl.value?.focus()
  }
}
onMounted(() => {
  document.addEventListener('click', handleDocClick)
  document.addEventListener('keydown', handleDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', handleDocClick)
  document.removeEventListener('keydown', handleDocKeydown)
})
</script>

<template>
  <nav ref="rootEl" class="bottom-nav">
    <!-- 主导航项 -->
    <button
      v-for="t in primaryTabs"
      :key="t.id"
      class="tab"
      :class="{ active: activeId === t.id }"
      :aria-current="activeId === t.id ? 'page' : undefined"
      @click="nav(t.path)"
    >
      <svg class="icon" style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
        <use :href="'#' + t.icon" />
      </svg>
      <span class="label">{{ t.label }}</span>
    </button>

    <!-- 更多按钮 -->
    <button
      ref="moreBtnEl"
      class="tab"
      :class="{ active: moreActive }"
      :aria-expanded="moreOpen"
      aria-haspopup="true"
      aria-controls="bottom-nav-more"
      @click="toggleMore"
    >
      <svg
        class="icon"
        :class="{ popped: moreOpen }"
        style="width: var(--icon-lg); height: var(--icon-lg)"
        aria-hidden="true"
      >
        <use href="#i-ui-more" />
      </svg>
      <span class="label">更多</span>
    </button>

    <!-- 更多面板（向上展开） -->
    <transition name="more-pop">
      <div v-if="moreOpen" id="bottom-nav-more" class="more-panel">
        <button
          v-for="t in secondaryTabs"
          :key="t.id"
          class="more-item"
          :class="{ active: activeId === t.id }"
          :aria-current="activeId === t.id ? 'page' : undefined"
          @click="navSecondary(t.path)"
        >
          <svg
            class="icon"
            style="width: var(--icon-md); height: var(--icon-md)"
            aria-hidden="true"
          >
            <use :href="'#' + t.icon" />
          </svg>
          <span>{{ t.label }}</span>
        </button>
      </div>
    </transition>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  /* display: flex 由全局 @media (max-width:767px) 控制 */
  display: flex;
  background: rgba(12, 17, 30, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--color-border-line);
  padding: var(--space-2) var(--space-1);
  padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom));
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1);
  color: var(--color-t-tertiary);
  transition: color 0.2s var(--ease-out);
  position: relative;
}
.tab .label {
  font-size: var(--text-xs);
  font-weight: 500;
}
.tab.active {
  color: var(--color-core);
}
.tab.active .icon {
  filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.5));
}

/* 更多按钮反馈——面板打开时图标微弹 */
.icon.popped {
  transform: scale(1.15);
}
.icon {
  transition: transform 0.2s var(--ease-out);
}

/* 更多面板——向上弹出 */
.more-panel {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-glow);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: min(160px, 100vw - 16px);
}
.more-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--radius-md, 8px);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-t-secondary);
  transition: all 0.15s var(--ease-out);
  white-space: nowrap;
}
.more-item:hover {
  background: var(--color-hover);
  color: var(--color-t-primary);
}
.more-item.active {
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.12), transparent);
  color: var(--color-core);
}

/* 面板出入场动画 */
.more-pop-enter-active,
.more-pop-leave-active {
  transition:
    opacity 0.18s var(--ease-out),
    transform 0.18s var(--ease-out);
  transform-origin: bottom right;
}
.more-pop-enter-from,
.more-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
