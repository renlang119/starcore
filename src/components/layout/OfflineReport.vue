<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { fmt, fmtTime } from '@/lib/format'
import { UNITS } from '@/data/units'

const game = useGameStore()
const report = computed(() => game.offlineReport)
const visible = computed(() => !!report.value)
const modalRef = ref<HTMLElement | null>(null)
useFocusTrap(modalRef, visible, { onEscape: dismiss })
const gainsList = computed(() => {
  if (!report.value) return []
  const metaMap = game.resources.allMeta
  return Object.entries(report.value.gains).map(([k, v]) => {
    const meta = metaMap[k]
    return { id: k, name: meta?.name ?? k, color: meta?.color ?? '#fff', amount: fmt(v) }
  })
})
const garrisonList = computed(() => {
  if (!report.value?.garrisonGains) return []
  const metaMap = game.resources.allMeta
  return Object.entries(report.value.garrisonGains).map(([k, v]) => {
    const meta = metaMap[k]
    return { id: k, name: meta?.name ?? k, color: meta?.color ?? '#fff', amount: fmt(v) }
  })
})
const trainedList = computed(() => {
  if (!report.value?.trainedUnits) return []
  return Object.entries(report.value.trainedUnits).map(([k, v]) => {
    const unit = UNITS.find((u) => u.id === k)
    return { id: k, name: unit?.name ?? k, count: v as number }
  })
})
function dismiss() {
  game.setOfflineReport(null)
}
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay lighter" @click.self="dismiss">
      <div ref="modalRef" class="modal" role="dialog" aria-modal="true" aria-label="离线收益报告">
        <h2 class="title font-display">离线收益报告</h2>
        <p class="subtitle">你离开了 {{ fmtTime(report?.duration ?? 0) }}</p>
        <div v-if="gainsList.length > 0" class="gains">
          <h3 class="section-title sub">建筑产出</h3>
          <div v-for="g in gainsList" :key="g.id" class="gain-item">
            <span class="g-name" :style="{ color: g.color }">{{ g.name }}</span>
            <span class="g-amount font-mono">+{{ g.amount }}</span>
          </div>
        </div>
        <div v-if="garrisonList.length > 0" class="garrison-section">
          <h3 class="garrison-title">据点驻扎收益</h3>
          <div class="gains">
            <div v-for="g in garrisonList" :key="g.id" class="gain-item">
              <span class="g-name" :style="{ color: g.color }">{{ g.name }}</span>
              <span class="g-amount font-mono">+{{ g.amount }}</span>
            </div>
          </div>
        </div>
        <div v-if="trainedList.length > 0" class="trained-section">
          <h3 class="trained-title">部队训练完成</h3>
          <div class="gains">
            <div v-for="t in trainedList" :key="t.id" class="gain-item">
              <span class="g-name">{{ t.name }}</span>
              <span class="g-amount font-mono">+{{ t.count }}</span>
            </div>
          </div>
        </div>
        <p
          v-if="gainsList.length === 0 && garrisonList.length === 0 && trainedList.length === 0"
          class="empty"
        >
          离线期间没有产出（建造更多建筑以获得离线收益）
        </p>
        <button class="btn-primary block" @click="dismiss">继续</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal {
  width: 100%;
  max-width: 360px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-glow);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  animation: modalIn 0.3s var(--ease-out);
}
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
.garrison-section {
  margin-bottom: var(--space-5);
}
.garrison-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-plasma, #a78bfa);
  margin-bottom: var(--space-2);
}
.trained-section {
  margin-bottom: var(--space-5);
}
.trained-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-alert);
  margin-bottom: var(--space-2);
}
</style>
