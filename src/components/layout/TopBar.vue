<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt, fmtRate } from '@/lib/format'
import { APP_VERSION } from '@/version'
import { useResourceParticles } from '@/composables/useResourceParticles'
import type { ResourceType } from '@/data/buildings'

const game = useGameStore()
const res = game.resources

// P2-5 资源变化高亮 — 监听格式化后的资源值，变化时 0.3s 短暂高亮变绿
// 使用 ref + watchEffect 替代 computed 内突变 reactive，消除副作用
const flashState = ref<Record<string, boolean>>({})
const prevAmounts: Record<string, string> = {}

const resourceList = computed(() => {
  const items: { id: string; name: string; icon: string; color: string; amount: string; rate: string; flash: boolean }[] = []
  for (const [id, meta] of Object.entries(res.allMeta)) {
    const amountStr = fmt(res.getAmount(id as ResourceType))
    items.push({
      id,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      amount: amountStr,
      rate: fmtRate(res.getRate(id as ResourceType)),
      flash: !!flashState.value[id],
    })
  }
  return items
})

// watchEffect 追踪资源数量变化，检测格式化值变化时触发高亮
// prevAmounts 为普通对象（非 reactive），避免在 effect 内突变响应式数据
watchEffect(() => {
  for (const [id] of Object.entries(res.allMeta)) {
    const amountStr = fmt(res.getAmount(id as ResourceType))
    const prev = prevAmounts[id]
    if (prev !== undefined && prev !== amountStr) {
      flashState.value[id] = true
      setTimeout(() => { flashState.value[id] = false }, 300)
    }
    prevAmounts[id] = amountStr
  }
})

// P3-6 资源产出粒子动画 — 仅 rate > 0 的资源才生成粒子
function getPositiveRateResources(): string[] {
  const ids: string[] = []
  for (const [id] of Object.entries(res.allMeta)) {
    if (res.getRate(id as ResourceType).gt(0)) ids.push(id)
  }
  return ids
}
const { particles } = useResourceParticles(getPositiveRateResources)
</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <span class="brand-name">星核纪元</span>
    </div>
    <ul class="res-strip" aria-label="资源">
      <li
        v-for="r in resourceList"
        :key="r.id"
        class="res-pill"
        :class="{ flash: r.flash }"
        :style="{ '--c': r.color }"
      >
        <svg class="r-icon" style="width: var(--icon-sm); height: var(--icon-sm)" aria-hidden="true"><use :href="'#' + r.icon" /></svg>
        <span class="r-amount font-mono">{{ r.amount }}</span>
        <span class="r-rate font-mono" :style="{ color: r.color }">{{ r.rate }}</span>
        <!-- P3-6 资源产出粒子 -->
        <span
          v-for="p in particles.filter((pt) => pt.resourceId === r.id)"
          :key="p.id"
          class="res-particle"
          :style="{ '--c': r.color }"
          aria-hidden="true"
        ></span>
      </li>
    </ul>
    <span class="version-tag font-mono" :title="`v${APP_VERSION}`">v{{ APP_VERSION }}</span>
  </header>
</template>

<style scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(5, 7, 13, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border-line);
  padding: var(--space-2) var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow-x: auto;
  scrollbar-width: none;
}
.brand-name {
  font-size: var(--text-sm);
  color: var(--color-core);
  white-space: nowrap;
}
.brand { display: none; }
@media (max-width: 767px) {
  .brand { display: block; }
}
.res-strip {
  display: flex;
  gap: var(--space-2);
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}
.res-strip::-webkit-scrollbar { display: none; }
.res-pill {
  position: relative; /* P3-6 粒子定位基准 */
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-pill);
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s var(--ease-out), box-shadow .15s var(--ease-out);
}
.r-icon { color: var(--c); flex-shrink: 0; }
.r-amount {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-t-primary);
}
/* P2-10 产出率字号优化 — 较数值更小、更淡，建立视觉层级 */
.r-rate {
  font-size: var(--text-xs);
  opacity: .55;
  font-weight: 400;
}
.version-tag {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  opacity: .6;
  white-space: nowrap;
  user-select: none;
}

/* P2-5 资源变化高亮 — 0.3s 短暂变绿过渡 */
.res-pill.flash .r-amount {
  animation: resFlash .3s var(--ease-out);
}
@keyframes resFlash {
  0% {
    color: var(--color-quantum);
    text-shadow: 0 0 6px rgba(46, 230, 160, .6);
  }
  100% {
    color: var(--color-t-primary);
    text-shadow: none;
  }
}

/* P2-10 窄屏渐变遮罩提示可滑动 */
@media (max-width: 767px) {
  .res-strip::after {
    content: "";
    position: sticky;
    right: 0;
    flex: 0 0 16px;
    margin-left: -16px;
    width: 16px;
    height: 100%;
    min-height: 32px;
    background: linear-gradient(to right, transparent, rgba(5, 7, 13, .9));
    pointer-events: none;
    z-index: 2;
  }
}

/* P3-6 资源产出粒子 — 2px 光点向上飘 28px */
.res-particle {
  position: absolute;
  top: 50%;
  right: 4px;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--c, var(--color-core));
  box-shadow: 0 0 4px var(--c, var(--color-core));
  pointer-events: none;
  animation: particleRise .8s var(--ease-out) forwards;
  z-index: 1;
}
@media (prefers-reduced-motion: reduce) {
  .res-particle {
    display: none;
  }
}
</style>
