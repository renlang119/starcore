<script setup lang="ts">
import { t } from '@/i18n'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmtTime } from '@/lib/format'
import { resourceRows } from '@/lib/resource-rows'
import { UNITS } from '@/data/units'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'

const game = useGameStore()
const visible = computed(() => !!game.offlineReport)

/**
 * 分组展示数据：标题 / 色调 / 行（资源行走 resourceRows，训练行查兵种表）。
 * 建筑产出沿用「标题行在列表内」的既有结构（titleInList），间距与其余分组不同属历史形态。
 */
const groups = computed(() => {
  const report = game.offlineReport
  if (!report) return []
  const metaMap = game.resources.allMeta
  return [
    {
      key: 'gains',
      title: t('offline.gainBuildings'),
      titleClass: 'section-title sub',
      color: '',
      titleInList: true,
      rows: resourceRows(report.gains, metaMap),
    },
    {
      key: 'garrison',
      title: t('offline.gainGarrison'),
      titleClass: 'gain-title',
      color: 'var(--color-plasma)',
      titleInList: false,
      rows: resourceRows(report.garrisonGains ?? {}, metaMap),
    },
    {
      key: 'event',
      title: t('offline.gainDeepSpace'),
      titleClass: 'gain-title',
      color: 'var(--color-core)',
      titleInList: false,
      rows: resourceRows(report.eventGains ?? {}, metaMap),
    },
    {
      key: 'dispatch',
      title: t('offline.dispatchTitle', { count: report.dispatchCount ?? 0 }),
      titleClass: 'gain-title',
      color: 'var(--color-quantum)',
      titleInList: false,
      rows: resourceRows(report.dispatchGains ?? {}, metaMap),
    },
    {
      key: 'trained',
      title: t('offline.gainTraining'),
      titleClass: 'gain-title',
      color: 'var(--color-alert)',
      titleInList: false,
      rows: Object.entries(report.trainedUnits ?? {}).map(([k, v]) => ({
        id: k,
        name: UNITS.find((u) => u.id === k)?.name ?? k,
        color: '',
        amount: String(v),
      })),
    },
  ].filter((g) => g.rows.length > 0)
})
function dismiss() {
  game.setOfflineReport(null)
}
</script>

<template>
  <ModalOverlay :model-value="visible" :aria-label="t('offline.title')" @overlay-click="dismiss">
    <h2 class="title font-display">{{ t('offline.title') }}</h2>
    <p class="subtitle">{{ t('offline.gone') }} {{ fmtTime(game.offlineReport?.duration ?? 0) }}</p>
    <div
      v-for="g in groups"
      :key="g.key"
      class="gain-section"
      :style="g.color ? { '--c': g.color } : undefined"
    >
      <h3 v-if="!g.titleInList" :class="g.titleClass">{{ g.title }}</h3>
      <div class="gains">
        <h3 v-if="g.titleInList" :class="g.titleClass">{{ g.title }}</h3>
        <div v-for="row in g.rows" :key="row.id" class="gain-item">
          <span class="g-name" :style="row.color ? { color: row.color } : undefined">{{
            row.name
          }}</span>
          <span class="g-amount font-mono">+{{ row.amount }}</span>
        </div>
      </div>
    </div>
    <p v-if="groups.length === 0" class="empty">{{ t('offline.emptyNote') }}</p>
    <button class="btn-primary block" @click="dismiss">{{ t('common.continue') }}</button>
  </ModalOverlay>
</template>

<style scoped>
.title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-core);
  margin-bottom: var(--space-1);
}
.subtitle {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-4);
}
.gains {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}
.gain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-3);
  background: var(--color-elevated);
  border-radius: var(--radius-md);
}
.g-name {
  font-size: var(--text-sm);
  font-weight: 500;
}
.g-amount {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-quantum);
}
.empty {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  text-align: center;
  padding: var(--space-4);
}
/* 分组区块（据点驻扎/深空事件/部队训练共用；标题色经 --c 注入） */
.gain-section {
  margin-bottom: var(--space-5);
}
.gain-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c);
  margin-bottom: var(--space-2);
}
</style>
