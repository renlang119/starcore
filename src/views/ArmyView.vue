<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { UNITS, getUnit, type UnitId } from '@/data/units'
import { getTech } from '@/data/tech'
import Icons from '@/components/ui/Icons.vue'
import CostTag from '@/components/ui/CostTag.vue'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useOnboarding } from '@/composables/useOnboarding'

const game = useGameStore()
const activeTab = ref<'barracks' | 'formation'>('barracks')
const trainCount = ref<Record<UnitId, number>>({ assault: 0, guard: 0, heavy: 0, psionic: 0 })
const selectedFormation = ref(0)

// 全入/全撤确认（大数量操作需确认）
const pendingBulkAction = ref<{
  type: 'assign' | 'remove'
  fid: string
  uid: UnitId
  count: number
} | null>(null)
const showBulkModal = computed(() => !!pendingBulkAction.value)

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding('army', ['army-train'])

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

const completedTechs = computed(() => game.research.completed)
const atkMult = computed(() => game.atkMult)
const defMult = computed(() => game.defMult)

const formations = computed(() => game.military.formations)

// 军事系统解锁状态：任一兵种解锁即可训练（military_basic）
const armyUnlocked = computed(() =>
  UNITS.some((u) => game.military.isUnlocked(u, completedTechs.value))
)

// 空状态（已解锁分支）：无已拥有部队且无训练中任务
const hasAnyUnits = computed(
  () =>
    UNITS.some((u) => game.military.getOwned(u.id) > 0) || game.military.trainingQueue.length > 0
)

const totalPower = computed(() => game.military.totalPower(atkMult.value, defMult.value))

// 训练并行槽：满槽时禁用训练按钮并提示（集群操练 I/II 各 +1 槽，上限 3）
const maxSlots = computed(() => game.military.maxTrainingSlots)
const slotsFull = computed(() => game.military.trainingQueue.length >= maxSlots.value)
const slotHint = computed(() => {
  if (!slotsFull.value) return ''
  if (maxSlots.value >= 3) return '训练槽已满'
  const nextTech = maxSlots.value < 2 ? '集群操练 I' : '集群操练 II'
  return `训练槽已满 · 研究「${nextTech}」可扩展至 ${maxSlots.value + 1} 槽`
})

function tryTrain(unitId: UnitId) {
  const count = trainCount.value[unitId]
  if (count <= 0) return
  game.military.startTraining(
    unitId,
    count,
    (c) => game.resources.canAfford(c),
    (c) => game.resources.spendCost(c)
  )
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
    atk: Math.round(def.attack * atkMult.value.toNumber()),
    def: Math.round(def.defense * defMult.value.toNumber()),
    hp: def.hp,
  }
}

function getInFormation(fid: string, uid: UnitId): number {
  return formations.value.find((f) => f.id === fid)?.units[uid] ?? 0
}

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
    <Icons />
    <h2 class="page-title font-display">部队</h2>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'army-train'"
      class="onboard-army"
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
    <div v-if="activeTab === 'barracks'" class="barracks">
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
          v-for="u in UNITS"
          :key="u.id"
          class="unit-card"
          :class="{ locked: !game.military.isUnlocked(u, completedTechs) }"
        >
          <div class="u-head">
            <div
              class="u-icon"
              :style="{
                color: u.rarity === 'rare' ? 'var(--color-amber)' : 'var(--color-t-primary)',
              }"
            >
              <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
                <use :href="'#' + u.icon" />
              </svg>
            </div>
            <div class="u-info">
              <div class="u-name">
                {{ u.name }} <span v-if="u.rarity === 'rare'" class="rare-tag">稀有</span>
              </div>
              <div class="u-count font-mono">已拥有：{{ game.military.getOwned(u.id) }}</div>
            </div>
          </div>
          <p class="u-desc">{{ u.desc }}</p>

          <div class="u-stats">
            <span class="stat">攻 {{ getUnitPower(u.id).atk }}</span>
            <span class="stat">防 {{ getUnitPower(u.id).def }}</span>
            <span class="stat">HP {{ getUnitPower(u.id).hp }}</span>
            <span class="stat counter"
              >克制 {{ u.counters.map((c) => getUnit(c)?.name ?? c).join('/') }}</span
            >
          </div>

          <div v-if="!game.military.isUnlocked(u, completedTechs)" class="u-locked">
            需要科技：{{ getTech(u.requires)?.name ?? u.requires }}
          </div>
          <template v-else>
            <!-- 训练数量 -->
            <div class="train-control">
              <button
                class="count-btn"
                @click="trainCount[u.id] = Math.max(0, trainCount[u.id] - 10)"
              >
                -10
              </button>
              <button
                class="count-btn"
                @click="trainCount[u.id] = Math.max(0, trainCount[u.id] - 1)"
              >
                -1
              </button>
              <span class="count-display font-mono">{{ trainCount[u.id] }}</span>
              <button class="count-btn" @click="trainCount[u.id] += 1">+1</button>
              <button class="count-btn" @click="trainCount[u.id] += 10">+10</button>
            </div>

            <!-- 成本 -->
            <div class="u-cost">
              <CostTag :cost="getUnitCost(u.id, trainCount[u.id])" />
              <span class="time-tag font-mono">{{ u.trainTime * trainCount[u.id] }}s</span>
            </div>

            <button
              class="btn-accent block"
              style="--accent: var(--color-alert)"
              :disabled="
                slotsFull ||
                trainCount[u.id] === 0 ||
                !game.resources.canAfford(getUnitCost(u.id, trainCount[u.id]))
              "
              @click="tryTrain(u.id)"
            >
              训练
            </button>
          </template>
        </div>

        <!-- 训练队列 -->
        <div v-if="game.military.trainingQueue.length > 0" class="train-queue">
          <h3 class="section-title">
            训练中（{{ game.military.trainingQueue.length }}/{{ maxSlots }}）
          </h3>
          <p v-if="slotHint" class="slot-hint">{{ slotHint }}</p>
          <div v-for="task in game.military.trainingQueue" :key="task.id" class="queue-item">
            <span class="q-name"
              >{{ getUnit(task.unitId)?.name ?? task.unitId }} ×{{ task.count }}</span
            >
            <div class="q-bar">
              <div
                class="q-fill"
                :style="{ width: (1 - task.remaining / task.totalTime) * 100 + '%' }"
              ></div>
            </div>
            <span class="q-time font-mono">{{ Math.ceil(task.remaining) }}s</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 编组 -->
    <div v-else class="formation-view">
      <div
        v-for="(f, idx) in formations"
        :key="f.id"
        class="formation-card"
        :class="{ selected: selectedFormation === idx }"
        @click="selectedFormation = idx"
      >
        <div class="f-head">
          <span class="f-name">{{ f.name }}</span>
          <span class="f-power font-mono"
            >战力 {{ game.military.formationPower(f, atkMult, defMult).atk }}</span
          >
        </div>
        <div class="f-units">
          <div v-for="u in UNITS" :key="u.id" class="f-unit-row">
            <div class="fu-top">
              <div class="fu-info">
                <svg style="width: var(--icon-sm); height: var(--icon-sm)" aria-hidden="true">
                  <use :href="'#' + u.icon" />
                </svg>
                <span class="fu-name">{{ u.name }}</span>
              </div>
              <div class="fu-numbers">
                <span class="fu-owned">库存 {{ game.military.getOwned(u.id) }}</span>
                <span class="fu-count font-mono">编入 {{ f.units[u.id] }}</span>
              </div>
            </div>
            <div class="fu-controls">
              <button
                class="fu-btn"
                :disabled="f.units[u.id] <= 0"
                @click.stop="removeCount(f.id, u.id, 10)"
              >
                -10
              </button>
              <button
                class="fu-btn"
                :disabled="f.units[u.id] <= 0"
                @click.stop="removeCount(f.id, u.id, 1)"
              >
                -1
              </button>
              <button
                class="fu-btn"
                :disabled="game.military.getOwned(u.id) <= 0"
                @click.stop="assignCount(f.id, u.id, 1)"
              >
                +1
              </button>
              <button
                class="fu-btn"
                :disabled="game.military.getOwned(u.id) <= 0"
                @click.stop="assignCount(f.id, u.id, 10)"
              >
                +10
              </button>
              <button
                class="fu-btn fu-btn-wide"
                :disabled="game.military.getOwned(u.id) <= 0"
                @click.stop="assignAll(f.id, u.id)"
              >
                全入
              </button>
              <button
                class="fu-btn fu-btn-wide fu-btn-remove"
                :disabled="f.units[u.id] <= 0"
                @click.stop="removeAll(f.id, u.id)"
              >
                全撤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量操作确认弹窗 -->
    <ModalOverlay
      v-model="showBulkModal"
      :aria-label="pendingBulkAction?.type === 'assign' ? '确认全入' : '确认全撤'"
      @overlay-click="cancelBulkAction"
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
      <div class="confirm-actions">
        <button class="btn-secondary" style="flex: 1" @click="cancelBulkAction">取消</button>
        <button
          class="btn-accent"
          style="flex: 1; --accent: var(--color-alert)"
          @click="confirmBulkAction"
        >
          确认
        </button>
      </div>
    </ModalOverlay>
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
}
.unit-card.locked {
  opacity: 0.5;
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
  border-radius: 3px;
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
  height: 4px;
  background: var(--color-elevated);
  border-radius: 2px;
  overflow: hidden;
}
.q-fill {
  height: 100%;
  background: var(--color-alert);
  transition: width 0.3s;
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
.formation-card.selected {
  border-color: var(--color-alert);
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

/* 批量操作确认弹窗 */
.confirm-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-alert);
  text-align: center;
  margin-bottom: var(--space-2);
}
.confirm-desc {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
  text-align: center;
  margin-bottom: var(--space-4);
}
.confirm-actions {
  display: flex;
  gap: var(--space-2);
}

/* P3-3 onboarding */
.onboard-army {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
