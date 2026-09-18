<script setup lang="ts">
/**
 * FormationPanel.vue — 编组面板（编队卡与批量编入 / 撤回）。
 *
 * 从 ArmyView 拆出：编队战力与各兵种库存 / 编入数、±1 ±10 直接调整、
 * 全入 / 全撤超过阈值时的二次确认弹窗。类名与文案保持不变。
 */
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { UNITS, type UnitId } from '@/data/units'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import Icon from '@/components/ui/Icon.vue'

const game = useGameStore()

// 全入/全撤确认（大数量操作需确认）
const pendingBulkAction = ref<{
  type: 'assign' | 'remove'
  fid: string
  uid: UnitId
  count: number
} | null>(null)
const showBulkModal = computed(() => !!pendingBulkAction.value)

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

function getInFormation(fid: string, uid: UnitId): number {
  return game.military.formations.find((f) => f.id === fid)?.units[uid] ?? 0
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
</template>

<style scoped>
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
</style>
