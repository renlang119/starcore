<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt, fmtTime } from '@/lib/format'
import { UNITS, getUnit, type UnitId } from '@/data/units'
import { getTech } from '@/data/tech'
import CostTag from '@/components/ui/CostTag.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import Toast from '@/components/ui/Toast.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useToast } from '@/composables/useToast'

const game = useGameStore()
// 全局轻提示（v0.77：训练开始反馈）
const toast = useToast()
const activeTab = ref<'barracks' | 'formation'>('barracks')
const trainCount = ref<Record<UnitId, number>>(
  Object.fromEntries(UNITS.map((u) => [u.id, 0])) as Record<UnitId, number>
)

// 全入/全撤确认（大数量操作需确认）
const pendingBulkAction = ref<{
  type: 'assign' | 'remove'
  fid: string
  uid: UnitId
  count: number
} | null>(null)
const showBulkModal = computed(() => !!pendingBulkAction.value)

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding(['army-train'])

// v0.86.2：满槽时训练按钮显示「训练中…」与最早完成队列的剩余时间，
// 替代此前无反馈的死「训练」文案（新手误以为按钮坏了）
const trainingEta = computed(() => {
  const queue = game.military.trainingQueue
  if (queue.length === 0) return ''
  const soonest = Math.min(...queue.map((t) => t.remaining))
  return fmtTime(soonest)
})

function confirmBulkAction() {
  const a = pendingBulkAction.value
  if (!a) return
  if (a.type === 'assign') doAssignAll(a.fid, a.uid)
  else doRemoveAll(a.fid, a.uid)
  pendingBulkAction.value = null
}
function cancelBulkAction() {
  pendingBulkAction.value = null
}

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

const totalPower = computed(() => game.military.totalPower(game.atkMult, game.defMult))

// 训练并行槽：满槽时禁用训练按钮并提示（集群操练 I/II 各 +1 槽，上限 3）
const slotsFull = computed(
  () => game.military.trainingQueue.length >= game.military.maxTrainingSlots
)
const slotHint = computed(() => {
  if (!slotsFull.value) return ''
  const max = game.military.maxTrainingSlots
  if (max >= 3) return '训练槽已满'
  const nextTech = max < 2 ? '集群操练 I' : '集群操练 II'
  return `训练槽已满 · 研究「${nextTech}」可扩展至 ${max + 1} 槽`
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
  if (ok) toast.show(`开始训练：${getUnit(unitId)?.name ?? unitId} ×${count}`)
  else toast.show(slotsFull.value ? '训练槽已满' : '资源不足')
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

function getInFormation(fid: string, uid: UnitId): number {
  return game.military.formations.find((f) => f.id === fid)?.units[uid] ?? 0
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

/** 编队卡视图行：战力与各兵种库存/编入数一次性派生 */
const formationRows = computed(() =>
  game.military.formations.map((f) => ({
    f,
    power: game.military.formationPower(f, game.atkMult, game.defMult).atk,
    units: UNITS.map((u) => ({
      def: u,
      owned: game.military.getOwned(u.id),
      inFormation: f.units[u.id],
    })),
  }))
)

function assignCount(fid: string, uid: UnitId, count: number) {
  const owned = game.military.getOwned(uid)
  const actual = Math.min(count, owned)
  if (actual > 0) game.military.assignToFormation(fid, uid, actual)
}

function removeCount(fid: string, uid: UnitId, count: number) {
  const actual = Math.min(count, getInFormation(fid, uid))
  if (actual > 0) game.military.removeFromFormation(fid, uid, actual)
}

/** 内部：直接执行全入（无确认检查） */
function doAssignAll(fid: string, uid: UnitId) {
  const owned = game.military.getOwned(uid)
  if (owned > 0) game.military.assignToFormation(fid, uid, owned)
}

/** 内部：直接执行全撤（无确认检查） */
function doRemoveAll(fid: string, uid: UnitId) {
  const inF = getInFormation(fid, uid)
  if (inF > 0) game.military.removeFromFormation(fid, uid, inF)
}

function assignAll(fid: string, uid: UnitId) {
  const owned = game.military.getOwned(uid)
  if (owned > 100) {
    pendingBulkAction.value = { type: 'assign', fid, uid, count: owned }
    return
  }
  doAssignAll(fid, uid)
}

function removeAll(fid: string, uid: UnitId) {
  const inF = getInFormation(fid, uid)
  if (inF > 100) {
    pendingBulkAction.value = { type: 'remove', fid, uid, count: inF }
    return
  }
  doRemoveAll(fid, uid)
}
</script>

<template>
  <div class="army-view">
    <h2 class="page-title font-display">部队</h2>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'army-train'"
      class="ob-army"
      title="部队"
      text="在兵营训练兵种，在编队页配置阵容后出征据点。"
      @dismiss="dismiss"
      @skip="skipAll"
    />

    <!-- 全军战力 -->
    <div class="power-bar">
      <div class="power-item">
        <span class="p-label">总攻击</span>
        <span class="p-value font-mono" style="color: var(--color-alert)">{{
          fmt(totalPower.atk)
        }}</span>
      </div>
      <div class="power-item">
        <span class="p-label">总防御</span>
        <span class="p-value font-mono" style="color: var(--color-core)">{{
          fmt(totalPower.def)
        }}</span>
      </div>
      <div class="power-item">
        <span class="p-label">总兵力</span>
        <span class="p-value font-mono" style="color: var(--color-quantum)">{{
          fmt(totalPower.hp)
        }}</span>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'barracks' }"
        @click="activeTab = 'barracks'"
      >
        兵营
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'formation' }"
        @click="activeTab = 'formation'"
      >
        编组
      </button>
    </div>

    <!-- 兵营：训练 -->
    <div v-if="activeTab === 'barracks'">
      <!-- 空状态 1：军事科技未解锁 -->
      <EmptyState
        v-if="!armyUnlocked"
        icon="i-nav-army"
        text="尚未组建部队"
        hint="研究「军事基础」科技后可训练部队"
        action="前往科技"
        to="/tech"
      />
      <!-- 已解锁但尚无部队：轻提示（单位卡片本身即训练入口，空态不遮挡卡片） -->
      <template v-else>
        <EmptyState
          v-if="!hasAnyUnits"
          icon="i-nav-army"
          text="部队尚未组建"
          hint="训练你的第一支星际防卫军"
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
                <span v-if="row.def.rarity === 'rare'" class="rare-tag">稀有</span>
              </div>
              <div class="u-count font-mono">已拥有：{{ row.owned }}</div>
            </div>
          </div>
          <p class="u-desc">{{ row.def.desc }}</p>

          <div class="u-stats">
            <span class="stat">攻 {{ row.power.atk }}</span>
            <span class="stat">防 {{ row.power.def }}</span>
            <span class="stat">HP {{ row.power.hp }}</span>
            <span class="stat counter"
              >克制 {{ row.def.counters.map((c) => getUnit(c)?.name ?? c).join('/') }}</span
            >
          </div>

          <div v-if="!row.unlocked" class="u-locked">
            需要科技：{{ getTech(row.def.requires)?.name ?? row.def.requires }}
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
              <span aria-live="polite">{{ slotsFull ? `训练中…剩 ${trainingEta}` : '训练' }}</span>
            </button>
          </template>
        </div>

        <!-- 训练队列 -->
        <div v-if="game.military.trainingQueue.length > 0" class="train-queue">
          <h3 class="section-title">
            训练中（{{ game.military.trainingQueue.length }}/{{ game.military.maxTrainingSlots }}）
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
    </div>

    <!-- 编组 -->
    <div v-else>
      <div v-for="row in formationRows" :key="row.f.id" class="formation-card">
        <div class="f-head">
          <span class="f-name">{{ row.f.name }}</span>
          <span class="f-power font-mono">战力 {{ row.power }}</span>
        </div>
        <div>
          <div v-for="cell in row.units" :key="cell.def.id" class="f-unit-row">
            <div class="fu-top">
              <div class="fu-info">
                <Icon :name="cell.def.icon" size="sm" />
                <span class="fu-name">{{ cell.def.name }}</span>
              </div>
              <div class="fu-numbers">
                <span class="fu-owned">库存 {{ cell.owned }}</span>
                <span class="fu-count font-mono">编入 {{ cell.inFormation }}</span>
              </div>
            </div>
            <div class="fu-controls">
              <button
                class="fu-btn"
                :disabled="cell.inFormation <= 0"
                @click.stop="removeCount(row.f.id, cell.def.id, 10)"
              >
                -10
              </button>
              <button
                class="fu-btn"
                :disabled="cell.inFormation <= 0"
                @click.stop="removeCount(row.f.id, cell.def.id, 1)"
              >
                -1
              </button>
              <button
                class="fu-btn"
                :disabled="cell.owned <= 0"
                @click.stop="assignCount(row.f.id, cell.def.id, 1)"
              >
                +1
              </button>
              <button
                class="fu-btn"
                :disabled="cell.owned <= 0"
                @click.stop="assignCount(row.f.id, cell.def.id, 10)"
              >
                +10
              </button>
              <button
                class="fu-btn fu-btn-wide"
                :disabled="cell.owned <= 0"
                @click.stop="assignAll(row.f.id, cell.def.id)"
              >
                全入
              </button>
              <button
                class="fu-btn fu-btn-wide fu-btn-remove"
                :disabled="cell.inFormation <= 0"
                @click.stop="removeAll(row.f.id, cell.def.id)"
              >
                全撤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 训练开始等轻提示（v0.77） -->
    <Toast :toast="toast" />

    <!-- 批量操作确认弹窗 -->
    <ConfirmModal
      :model-value="showBulkModal"
      :aria-label="pendingBulkAction?.type === 'assign' ? '确认全入' : '确认全撤'"
      confirm-text="确认"
      @cancel="cancelBulkAction"
      @confirm="confirmBulkAction"
    >
      <h2 class="confirm-title font-display">
        {{ pendingBulkAction?.type === 'assign' ? '确认全入' : '确认全撤' }}
      </h2>
      <p class="confirm-desc">
        即将{{ pendingBulkAction?.type === 'assign' ? '编入' : '撤出' }}
        <span class="font-mono" style="color: var(--color-alert)">{{
          pendingBulkAction?.count
        }}</span>
        名士兵
      </p>
    </ConfirmModal>
  </div>
</template>

<style scoped>
.army-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-title {
  color: var(--color-alert);
}

.power-bar {
  display: flex;
  gap: var(--space-2);
}
.power-item {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  text-align: center;
}
.p-label {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.p-value {
  font-size: var(--text-base);
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: var(--space-2);
}
.tab {
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-t-secondary);
}
.tab.active {
  background: var(--color-alert);
  color: var(--color-on-core);
  border-color: var(--color-alert);
}

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
  color: var(--color-locked); /* P2-7：卡名迁移；锁定不降 opacity */
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
} /* P2-7 */

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

.formation-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}
.f-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}
.f-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.f-power {
  font-size: var(--text-xs);
  color: var(--color-alert);
}
.f-unit-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-line);
}
.f-unit-row:last-child {
  border-bottom: none;
}
.fu-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fu-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.fu-name {
  font-size: var(--text-xs);
}
.fu-numbers {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.fu-owned {
  color: var(--color-t-tertiary);
}
.fu-count {
  color: var(--color-alert);
  font-weight: 600;
}
.fu-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.fu-btn {
  min-width: 36px;
  height: 28px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-elevated);
  font-size: var(--text-xs);
  font-weight: 600;
}
.fu-btn:disabled {
  opacity: 0.4;
}
.fu-btn-wide {
  min-width: 42px;
}
.fu-btn-remove {
  color: var(--color-alert);
}

/* 批量操作确认弹窗（.confirm-title/.confirm-actions 为全局类） */
.confirm-desc {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
  text-align: center;
  margin-bottom: var(--space-4);
}
/* P3-3 onboarding（变体类承载定位与层级，v0.97） */
.ob-army {
  position: relative;
  width: 100%;
  margin-bottom: var(--space-2);
  z-index: 60;
}
</style>
