<script setup lang="ts">
/**
 * BarracksPanel.vue — 兵营面板（训练与训练队列）。
 *
 * 从 ArmyView 拆出：解锁空态、单位卡（训练数量 / 成本 / 战力 / 训练按钮）
 * 与训练队列进度。类名与文案保持不变；训练反馈经 feedback 事件交回视图
 * 层轻提示（提示挂载在视图根部，随视图加载卸载）。
 */
import { t } from '@/i18n'
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmtTime } from '@/lib/format'
import { UNITS, getUnit, type UnitId } from '@/data/units'
import { getTech } from '@/data/tech'
import CostTag from '@/components/ui/CostTag.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits<{ feedback: [msg: string] }>()

const game = useGameStore()

const trainCount = ref<Record<UnitId, number>>(
  Object.fromEntries(UNITS.map((u) => [u.id, 0])) as Record<UnitId, number>
)

// v0.86.2：满槽时训练按钮显示「训练中…」与最早完成队列的剩余时间，
// 替代此前无反馈的死「训练」文案（新手误以为按钮坏了）
const trainingEta = computed(() => {
  const queue = game.military.trainingQueue
  if (queue.length === 0) return ''
  const soonest = Math.min(...queue.map((t) => t.remaining))
  return fmtTime(soonest)
})

/** 军事系统解锁状态：任一兵种解锁即可训练（military_basic） */
const armyUnlocked = computed(() =>
  UNITS.some((u) => game.military.isUnlocked(u, game.research.completed))
)

// 空状态（已解锁分支）：无全量部队（含编入编队）且无训练中任务（v0.95 全量口径）
const hasAnyUnits = computed(
  () =>
    UNITS.some((u) => game.military.totalOwnedOf(u.id) > 0) ||
    game.military.trainingQueue.length > 0
)

// 训练并行槽：满槽时禁用训练按钮并提示（上限 3，由科技「集群操练 I/II」递增，见 military.maxTrainingSlots）
const slotsFull = computed(
  () => game.military.trainingQueue.length >= game.military.maxTrainingSlots
)
const slotHint = computed(() => {
  if (!slotsFull.value) return ''
  const max = game.military.maxTrainingSlots
  if (max >= 3) return t('army.slotsFull')
  const nextTech = max < 2 ? t('army.trainingTech1') : t('army.trainingTech2')
  return t('army.slotsFullHint', { nextTech: nextTech, slots: max + 1 })
})

function tryTrain(unitId: UnitId) {
  const count = trainCount.value[unitId]
  if (count <= 0) return
  const ok = game.military.startTraining(
    unitId,
    count,
    (c) => game.resources.canAfford(c),
    (c) => game.resources.spendCost(c)
  )
  // 长周期操作「开始」反馈（v0.77 反馈口径）；失败路径明示原因（连点竞态等边缘场景）
  if (ok)
    emit(
      'feedback',
      t('army.trainStarted', { unitName: getUnit(unitId)?.name ?? unitId, count: count })
    )
  else emit('feedback', slotsFull.value ? t('army.slotsFull') : t('common.insufficient'))
}

function getUnitCost(unitId: UnitId, count: number) {
  const def = getUnit(unitId)
  if (!def) return {}
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(def.cost)) result[k] = (v as number) * count
  return result
}

function getUnitPower(unitId: UnitId) {
  const def = getUnit(unitId)
  if (!def) return { atk: 0, def: 0, hp: 0 }
  return {
    atk: Math.round(def.attack * game.atkMult.toNumber()),
    def: Math.round(def.defense * game.defMult.toNumber()),
    hp: def.hp,
  }
}

/** 兵营单位卡视图行：解锁/拥有/战力/成本/可负担一次性派生（模板不再逐处重复调用） */
const unitRows = computed(() =>
  UNITS.map((u) => {
    const count = trainCount.value[u.id]
    const cost = getUnitCost(u.id, count)
    return {
      def: u,
      count,
      unlocked: game.military.isUnlocked(u, game.research.completed),
      owned: game.military.totalOwnedOf(u.id),
      power: getUnitPower(u.id),
      cost,
      canAfford: game.resources.canAfford(cost),
    }
  })
)
</script>

<template>
  <!-- 空状态 1：军事科技未解锁 -->
  <EmptyState
    v-if="!armyUnlocked"
    icon="i-nav-army"
    :text="t('army.emptyTitle')"
    :hint="t('army.emptyHint')"
    :action="t('common.goTech')"
    to="/tech"
  />
  <!-- 空状态 2：已解锁但无存量、编入与在训任务（单位卡片本身即训练入口，空态不遮挡卡片） -->
  <template v-else>
    <EmptyState
      v-if="!hasAnyUnits"
      icon="i-nav-army"
      :text="t('army.unitsEmptyTitle')"
      :hint="t('army.unitsEmptyHint')"
    />
    <div
      v-for="row in unitRows"
      :key="row.def.id"
      class="unit-card"
      :class="{ locked: !row.unlocked }"
    >
      <div class="u-head">
        <div
          class="u-icon"
          :style="{
            color: row.def.rarity === 'rare' ? 'var(--color-amber)' : 'var(--color-t-primary)',
          }"
        >
          <Icon :name="row.def.icon" size="lg" />
        </div>
        <div>
          <div class="u-name">
            {{ row.def.name }}
            <span v-if="row.def.rarity === 'rare'" class="rare-tag">{{
              t('common.rarity.rare')
            }}</span>
          </div>
          <div class="u-count font-mono">{{ t('army.owned') }}{{ row.owned }}</div>
        </div>
      </div>
      <p class="u-desc">{{ row.def.desc }}</p>

      <div class="u-stats">
        <span class="stat">{{ t('common.statAttack') }} {{ row.power.atk }}</span>
        <span class="stat">{{ t('common.statDefense') }} {{ row.power.def }}</span>
        <span class="stat">HP {{ row.power.hp }}</span>
        <span class="stat counter"
          >{{ t('army.counter') }}
          {{ row.def.counters.map((c) => getUnit(c)?.name ?? c).join('/') }}</span
        >
      </div>

      <div v-if="!row.unlocked" class="u-locked">
        {{ t('common.needsTech') }}{{ getTech(row.def.requires)?.name ?? row.def.requires }}
      </div>
      <template v-else>
        <!-- 训练数量 -->
        <div class="train-control">
          <button
            class="count-btn"
            @click="trainCount[row.def.id] = Math.max(0, trainCount[row.def.id] - 10)"
          >
            -10
          </button>
          <button
            class="count-btn"
            @click="trainCount[row.def.id] = Math.max(0, trainCount[row.def.id] - 1)"
          >
            -1
          </button>
          <span class="count-display font-mono">{{ row.count }}</span>
          <button class="count-btn" @click="trainCount[row.def.id] += 1">+1</button>
          <button class="count-btn" @click="trainCount[row.def.id] += 10">+10</button>
        </div>

        <!-- 成本 -->
        <div class="u-cost">
          <CostTag :cost="row.cost" />
          <span class="time-tag font-mono">{{ fmtTime(row.def.trainTime * row.count) }}</span>
        </div>

        <button
          class="btn-accent block"
          style="--accent: var(--color-alert)"
          :disabled="slotsFull || row.count === 0 || !row.canAfford"
          @click="tryTrain(row.def.id)"
        >
          <span aria-live="polite">{{
            slotsFull ? t('army.trainingEta', { trainingEta: trainingEta }) : t('army.train')
          }}</span>
        </button>
      </template>
    </div>

    <!-- 训练队列 -->
    <div v-if="game.military.trainingQueue.length > 0" class="train-queue">
      <h3 class="section-title">
        {{
          t('army.training', {
            doing: game.military.trainingQueue.length,
            total: game.military.maxTrainingSlots,
          })
        }}
      </h3>
      <p v-if="slotHint" class="slot-hint">{{ slotHint }}</p>
      <div v-for="task in game.military.trainingQueue" :key="task.id" class="queue-item">
        <span class="q-name"
          >{{ getUnit(task.unitId)?.name ?? task.unitId }} ×{{ task.count }}</span
        >
        <ProgressBar
          class="q-bar"
          fill-class="q-fill"
          :pct="(1 - task.remaining / task.totalTime) * 100"
        />
        <span class="q-time font-mono">{{ fmtTime(task.remaining) }}</span>
      </div>
    </div>
  </template>
</template>

<style scoped>
.unit-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  transition:
    transform 0.2s var(--ease-out),
    border-color 0.2s,
    box-shadow 0.2s var(--ease-out);
}
.unit-card:not(.locked):hover {
  transform: translateY(-2px);
  border-color: var(--color-border-glow);
  box-shadow: var(--elevation-2);
}
.unit-card:not(.locked):active {
  transform: translateY(0) scale(0.98);
  transition: transform 0.1s var(--ease-out);
}
.unit-card.locked .u-name {
  color: var(--color-locked); /* 卡名迁移；锁定不降 opacity */
}
.u-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.u-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}
.u-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.rare-tag {
  font-size: var(--text-xs);
  padding: 1px var(--space-1);
  background: var(--color-amber);
  color: var(--color-void);
  border-radius: var(--radius-xs);
}
.u-count {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.u-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.u-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.stat.counter {
  color: var(--color-amber);
}

.train-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.count-btn {
  width: 36px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-elevated);
  font-size: var(--text-xs);
  font-weight: 600;
}
.count-display {
  min-width: 32px;
  text-align: center;
  font-size: var(--text-sm);
  font-weight: 700;
}

.u-cost {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-2);
}

.u-locked {
  font-size: var(--text-xs);
  color: var(--color-locked);
  text-align: center;
  padding: var(--space-2);
}

.train-queue {
  margin-top: var(--space-2);
}
.slot-hint {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.queue-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}
.q-name {
  font-size: var(--text-xs);
  flex-shrink: 0;
  width: 100px;
}
.q-bar {
  flex: 1;
  --pb-h: 4px;
  --pb-radius: 2px;
  --pb-fill: var(--color-alert);
  --pb-fill-radius: 0;
}
.q-time {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  width: 32px;
  text-align: right;
}
</style>
