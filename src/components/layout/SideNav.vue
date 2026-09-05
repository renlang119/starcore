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
const activeId = computed(() => navItems.find((n) => n.path === route.path)?.id ?? 'home')
function nav(path: string) {
  router.push(path)
}

const negEntropy = computed(() => fmt(game.transcend.negativeEntropy))

// P2-8 SideNav 可折叠 — 状态记忆 localStorage（纯客户端 SPA，无 SSR 风险）
const COLLAPSE_KEY = 'starcore:sidenav-collapsed'
const collapsed = ref(false)
try {
  collapsed.value = localStorage.getItem(COLLAPSE_KEY) === 'true'
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
        style="width: var(--icon-sm); height: var(--icon-sm)"
        aria-hidden="true"
        :style="{ transform: collapsed ? 'rotate(180deg)' : 'none' }"
      >
        <path
          d="M15 18l-6-6 6-6"
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
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.4);
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
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.12), transparent);
  color: var(--color-core);
  border-left: 2px solid var(--color-core);
}
.nav-label {
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.15s var(--ease-out);
}
.side-nav.collapsed .nav-label {
  opacity: 0;
}
.side-nav.collapsed .nav-item {
  justify-content: center;
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

/* P2-8 折叠按钮 */
.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  margin-top: var(--space-2);
  border-radius: var(--radius-md);
  color: var(--color-t-tertiary);
  transition: all 0.15s var(--ease-out);
  flex-shrink: 0;
}
.collapse-toggle:hover {
  background: var(--color-hover);
  color: var(--color-t-primary);
}
.collapse-toggle svg {
  transition: transform 0.2s var(--ease-out);
}
</style>
