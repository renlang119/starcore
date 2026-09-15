<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { NAV_ITEMS } from '@/data/navigation'

const route = useRoute()
const router = useRouter()
const game = useGameStore()

const navItems = NAV_ITEMS
/** 匹配不到（如战斗页 /battle/:id）返回 undefined：不高亮、不打 aria-current（v0.95） */
const activeId = computed(() => navItems.find((n) => n.path === route.path)?.id)
function nav(path: string) {
  router.push(path)
}

const negEntropy = computed(() => fmt(game.transcend.negativeEntropy))

// P2-8 SideNav 可折叠 — 状态记忆 localStorage（纯客户端 SPA，无 SSR 风险）
const COLLAPSE_KEY = 'starcore_sidenav_collapsed'
/** 旧键（冒号风格）：读取一次后迁移清除，保持键名规范统一（v0.84） */
const COLLAPSE_KEY_LEGACY = 'starcore:sidenav-collapsed'
const collapsed = ref(false)
try {
  let stored = localStorage.getItem(COLLAPSE_KEY)
  if (stored === null) {
    const legacy = localStorage.getItem(COLLAPSE_KEY_LEGACY)
    if (legacy !== null) {
      stored = legacy
      localStorage.setItem(COLLAPSE_KEY, legacy)
      localStorage.removeItem(COLLAPSE_KEY_LEGACY)
    }
  }
  collapsed.value = stored === 'true'
} catch {
  /* localStorage 不可用时静默降级 */
}
function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed.value))
  } catch {
    /* */
  }
}
</script>

<template>
  <nav class="side-nav" :class="{ collapsed }">
    <div class="brand">
      <div class="brand-mark"></div>
      <span class="brand-name">星核纪元</span>
    </div>
    <button
      v-for="n in navItems"
      :key="n.id"
      class="nav-item"
      :class="{ active: activeId === n.id }"
      :aria-current="activeId === n.id ? 'page' : undefined"
      :title="collapsed ? n.label : undefined"
      :aria-label="collapsed ? n.label : undefined"
      @click="nav(n.path)"
    >
      <svg class="icon" style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
        <use :href="'#' + n.icon" />
      </svg>
      <span class="nav-label">{{ n.label }}</span>
    </button>
    <div class="side-footer">
      <div class="stat">
        <span class="label">负熵</span>
        <span class="val font-mono" style="color: var(--color-amber)">{{ negEntropy }}</span>
      </div>
    </div>
    <button
      class="collapse-toggle"
      :aria-label="collapsed ? '展开侧栏' : '折叠侧栏'"
      :title="collapsed ? '展开侧栏' : '折叠侧栏'"
      @click="toggleCollapsed"
    >
      <svg
        viewBox="0 0 24 24"
        style="width: var(--icon-md); height: var(--icon-md)"
        aria-hidden="true"
        :style="{ transform: collapsed ? 'rotate(180deg)' : 'none' }"
      >
        <!-- 面板收合图标：面板轮廓 + 分隔线 + 指向面板的收合箭头（折叠态 180° 翻转后箭头朝外=展开） -->
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
        <path d="M9 4v16" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M17.5 12 H 12.5 M 14.5 10 L 12.5 12 L 14.5 14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.side-nav {
  width: 200px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border-line);
  padding: var(--space-4) var(--space-3);
  /* display: flex 由全局 @media (min-width:768px) 控制 */
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  transition: width 0.2s var(--ease-out);
}
.side-nav.collapsed {
  width: 48px;
  padding: var(--space-4) var(--space-2);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-5);
  overflow: hidden;
}
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  background: radial-gradient(
    circle,
    var(--color-core) 0%,
    var(--color-core-deep) 70%,
    transparent 100%
  );
  box-shadow: 0 0 16px color-mix(in srgb, var(--color-core) 40%, transparent);
  animation: corePulse 3s ease-in-out infinite;
}
.brand-name {
  font-size: var(--text-base);
  color: var(--color-core);
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.15s var(--ease-out);
}
.side-nav.collapsed .brand-name {
  opacity: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-t-secondary);
  transition: all 0.15s var(--ease-out);
  overflow: hidden;
}
.nav-item:hover {
  background: var(--color-hover);
  color: var(--color-t-primary);
}
.nav-item.active {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-core) 12%, transparent),
    transparent
  );
  color: var(--color-core);
  border-left: 2px solid var(--color-core);
}
.nav-label {
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.15s var(--ease-out);
}
.side-nav.collapsed .nav-label {
  /* v0.95：真正移出布局（原 opacity:0 仍占位、图标被压缩至 0 宽不可见） */
  display: none;
}
.side-nav.collapsed .nav-item {
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}
.side-nav.collapsed .nav-item .icon {
  flex-shrink: 0;
}

.side-footer {
  margin-top: auto;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow: hidden;
  transition: opacity 0.15s var(--ease-out);
}
.side-nav.collapsed .side-footer {
  opacity: 0;
}
.stat {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
}
.stat .label {
  color: var(--color-t-tertiary);
}
.stat .val {
  color: var(--color-t-primary);
}

/* P2-8 折叠按钮（v0.85 重设计：面板收合图标 + 常驻边框控件态） */
.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0;
  margin-top: var(--space-2);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  background: var(--color-hover);
  color: var(--color-t-secondary);
  transition: all 0.15s var(--ease-out);
  flex-shrink: 0;
  overflow: hidden;
}
.collapse-toggle:hover {
  border-color: var(--color-core);
  color: var(--color-core);
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-core) 25%, transparent);
}
.collapse-toggle svg {
  transition: transform 0.2s var(--ease-out);
}
</style>
