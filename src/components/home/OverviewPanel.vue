<script setup lang="ts">
// OverviewPanel — 首页文明概况（v0.54 从 HomeView 拆出）
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmtTime } from '@/lib/format'
import { BUILDINGS } from '@/data/buildings'
import { TECHS } from '@/data/tech'

const game = useGameStore()

// —— 文明概况 ——
const buildingsUnlocked = computed(() => {
  const completed = game.research.completed
  return BUILDINGS.filter((b) => !b.requires || completed.has(b.requires)).length
})
const techCompleted = computed(() => game.research.count)
const totalUnits = computed(() => game.military.totalUnits)
const relicsEquipped = computed(() => game.relics.equippedRelics.length)
const playTime = computed(() => fmtTime(game.totalPlayTime))

// 文明概况指标列表（P1-6 视觉层次）
interface OverviewItem {
  key: string
  label: string
  value: string
  icon: string
  color: string
}
const overviewItems = computed<OverviewItem[]>(() => {
  const items: OverviewItem[] = [
    {
      key: 'buildings',
      label: '建筑',
      value: `${buildingsUnlocked.value}/${BUILDINGS.length}`,
      icon: 'i-nav-build',
      color: 'var(--color-core)',
    },
    {
      key: 'tech',
      label: '科技',
      value: `${techCompleted.value}/${TECHS.length}`,
      icon: 'i-nav-tech',
      color: 'var(--color-plasma)',
    },
    {
      key: 'army',
      label: '部队',
      value: `${totalUnits.value}`,
      icon: 'i-nav-army',
      color: 'var(--color-alert)',
    },
    {
      key: 'relics',
      label: '遗物',
      value: `${relicsEquipped.value}/${game.relics.maxSlots}`,
      icon: 'i-nav-relic',
      color: 'var(--color-amber)',
    },
    {
      key: 'playtime',
      label: '时长',
      value: playTime.value,
      icon: 'i-ui-more',
      color: 'var(--color-t-primary)',
    },
  ]
  if (game.transcend.totalTranscends > 0) {
    items.push({
      key: 'transcends',
      label: '转生',
      value: `${game.transcend.totalTranscends}`,
      icon: 'i-nav-prestige',
      color: 'var(--color-amber)',
    })
  }
  return items
})
</script>

<template>
  <!-- 文明概况（P1-6 视觉层次，P1-3 桌面 6 列） -->
  <section class="overview" aria-labelledby="overview-title">
    <h3 id="overview-title" class="section-title">文明概况</h3>
    <ul class="overview-grid">
      <li
        v-for="item in overviewItems"
        :key="item.key"
        class="ov-item"
        :style="{ '--ov-color': item.color }"
      >
        <div class="ov-top">
          <svg
            class="ov-icon"
            style="width: var(--icon-sm); height: var(--icon-sm)"
            aria-hidden="true"
          >
            <use :href="'#' + item.icon" />
          </svg>
          <span class="ov-value font-mono" :style="{ color: item.color }">{{ item.value }}</span>
        </div>
        <span class="ov-label">{{ item.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* —— P1-6 文明概况 —— */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.ov-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--ov-color, var(--color-core));
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  transition: all 0.2s var(--ease-out);
  box-shadow: var(--elevation-1); /* P2-6 */
}
.ov-item:hover {
  background: var(--color-hover);
  border-color: var(--color-border-glow);
  transform: translateY(-2px); /* P2-4 */
  box-shadow: var(--elevation-2); /* P2-6 */
}
.ov-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}
.ov-icon {
  color: var(--ov-color, var(--color-core));
  flex-shrink: 0;
}
.ov-value {
  font-size: var(--text-sm);
  font-weight: 600;
}
.ov-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  text-align: center;
}

/* P1-6 桌面端 6 列横排 */
@media (min-width: 768px) {
  .overview-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: var(--space-3);
  }
  .ov-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
  .ov-top {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
  }
  .ov-value {
    font-size: var(--text-base);
  }
}
</style>
