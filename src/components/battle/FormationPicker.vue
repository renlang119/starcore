<script setup lang="ts">
/**
 * FormationPicker.vue — 战斗页编队选择（从 BattleView 拆出）。
 *
 * 编队页签（名称 + 战力）与编队明细行；选中下标由父层持有并回传，
 * 空编队与据点未解锁的提示沿用原文案。类名保持不变。
 */
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'

defineProps<{
  /** 当前选中编队下标 */
  selected: number
  /** 当前编队明细行（含兵种名与数量） */
  rows: { unitId: string; name: string; count: number }[]
  /** 当前编队是否为空 */
  empty: boolean
  /** 据点是否已解锁（非远征分支） */
  unlocked: boolean
  /** 是否无尽远征（远征不渲染「据点未解锁」提示） */
  isEndless: boolean
}>()

const emit = defineEmits<{ select: [idx: number] }>()

const game = useGameStore()
</script>

<template>
  <div>
    <h3 class="section-title">选择编队</h3>
    <div class="formation-tabs">
      <button
        v-for="(f, idx) in game.military.formations"
        :key="f.id"
        class="f-tab"
        :class="{ active: selected === idx }"
        @click="emit('select', idx)"
      >
        {{ f.name }} · {{ fmt(game.military.formationPower(f, game.atkMult, game.defMult).atk) }}
      </button>
    </div>
    <div class="formation-detail">
      <div v-for="r in rows" :key="r.unitId" class="fu-row">
        <span>{{ r.name }}</span>
        <span class="font-mono">×{{ r.count }}</span>
      </div>
      <div v-if="empty" class="empty-msg">编队为空，请先在部队页面分配兵力</div>
      <div v-else-if="!unlocked && !isEndless" class="empty-msg">据点尚未解锁，无法出征</div>
    </div>
  </div>
</template>

<style scoped>
.formation-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.f-tab {
  flex: 1;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.f-tab.active {
  background: var(--color-alert);
  color: var(--color-on-core);
  border-color: var(--color-alert);
}
.formation-detail {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.fu-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  padding: var(--space-1) 0;
}
</style>
