<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import {
  RARITY_INFO,
  getSetByRelic,
  MAX_RELIC_LEVEL,
  ENHANCE_GAIN,
  enhanceLabel,
} from '@/data/relics'
import type { RelicRarity, RelicEffect } from '@/data/relics'
import { enhancedEffectsOf, type OwnedRelic } from '@/stores/relics'
import { fmt } from '@/lib/format'
import Icons from '@/components/ui/Icons.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'

const game = useGameStore()

const owned = computed(() => game.relics.owned)
const equipped = computed(() => game.relics.equipped)
const equippedRelics = computed(() => game.relics.equippedRelics)
const setProgress = computed(() => game.relics.setProgress)
const ownedKinds = computed(() => game.relics.ownedKinds)

// —— 合成工坊（v0.61）：选材模式下点卡选材料，非选材模式点卡装备 ——
const selectedMaterials = ref<string[]>([])
/** 选材模式开关：开启后图鉴卡点击=选材料 */
const selectMode = ref(false)
function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) clearSelection()
}
/** 是否可作为合成材料：未装备且非顶档 */
function selectable(r: OwnedRelic): boolean {
  return !game.relics.isEquipped(r.instanceId) && r.rarity !== 'legendary'
}
function isMaterialSelected(r: OwnedRelic): boolean {
  return selectedMaterials.value.includes(r.instanceId)
}
function toggleMaterial(r: OwnedRelic) {
  if (!selectable(r)) return
  const i = selectedMaterials.value.indexOf(r.instanceId)
  if (i >= 0) {
    selectedMaterials.value.splice(i, 1)
    return
  }
  // 选中组内稀有度须一致（先选什么稀有度，后续只能加同档）
  if (selectedMaterials.value.length > 0 && materialRarity.value !== r.rarity) {
    showToast('材料稀有度须一致')
    return
  }
  if (selectedMaterials.value.length < 3) selectedMaterials.value.push(r.instanceId)
}
/** 选中组的稀有度（0 或 3 件时有值；3 件必同稀有度，由 toggle 保证） */
const NEXT_RARITY_NAME: Record<string, string> = {
  common: '稀有',
  rare: '史诗',
  epic: '传说',
}
const materialRarity = computed<RelicRarity | null>(() => {
  if (selectedMaterials.value.length === 0) return null
  const first = owned.value.find((r) => r.instanceId === selectedMaterials.value[0])
  return first?.rarity ?? null
})
const canSynthesize = computed(() => {
  if (selectedMaterials.value.length !== 3) return false
  const mats = selectedMaterials.value
    .map((id) => owned.value.find((r) => r.instanceId === id))
    .filter(Boolean) as OwnedRelic[]
  return mats.length === 3 && mats.every((m) => m.rarity === mats[0].rarity)
})
const synthResult = ref<OwnedRelic | null>(null)
const synthFailMsg = ref('')

function doSynthesize() {
  synthFailMsg.value = ''
  const result = game.relics.synthesize(selectedMaterials.value)
  if (result) {
    synthResult.value = result
    selectedMaterials.value = []
  } else {
    synthFailMsg.value = '合成失败：需 3 件未装备的同稀有度遗物'
  }
}
function clearSelection() {
  selectedMaterials.value = []
  synthFailMsg.value = ''
}

function equip(relic: OwnedRelic, slot: number) {
  // 槽位全满时 findIndex 返回 -1，需明确提示玩家
  if (slot < 0) {
    showToast('装备槽位已满，请先卸下一个遗物')
    return
  }
  if (equipped.value[slot] === relic.instanceId) {
    game.relics.unequip(slot)
  } else {
    game.relics.equip(relic.instanceId, slot)
  }
}

/** 图鉴卡点击：点在丢弃按钮上不劫持；选材模式下点卡=选材料，否则=装备 */
function onCardClick(r: OwnedRelic, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.discard-btn')) return
  if (selectMode.value) {
    toggleMaterial(r)
    return
  }
  equip(
    r,
    equipped.value.findIndex((s) => s === null)
  )
}

// —— 装备槽满提示 toast ——
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 2000)
}

function getRarityColor(rarity: string): string {
  return RARITY_INFO[rarity as keyof typeof RARITY_INFO]?.color ?? '#fff'
}

// —— 丢弃功能（两次点击确认） ——
const pendingDiscardId = ref<string | null>(null)
let discardTimer: ReturnType<typeof setTimeout> | null = null

function handleDiscard(e: Event, relic: OwnedRelic) {
  e.stopPropagation()
  // 正在装备中的遗物不允许直接丢弃
  if (game.relics.isEquipped(relic.instanceId)) return
  if (pendingDiscardId.value === relic.instanceId) {
    // 第二次点击 → 确认丢弃
    game.relics.discard(relic.instanceId)
    pendingDiscardId.value = null
    if (discardTimer) {
      clearTimeout(discardTimer)
      discardTimer = null
    }
  } else {
    // 第一次点击 → 进入待确认状态
    pendingDiscardId.value = relic.instanceId
    if (discardTimer) clearTimeout(discardTimer)
    discardTimer = setTimeout(() => {
      pendingDiscardId.value = null
    }, 3000)
  }
}

// —— 强化（v0.70）：instance 级等级轴 ——
const selectedEnhance = ref<OwnedRelic | null>(null)
const enhanceToast = ref('')
let enhanceToastTimer: ReturnType<typeof setTimeout> | null = null

function openEnhance(r: OwnedRelic) {
  selectedEnhance.value = r
}
function closeEnhance() {
  selectedEnhance.value = null
}
function showEnhanceToast(msg: string) {
  enhanceToast.value = msg
  if (enhanceToastTimer) clearTimeout(enhanceToastTimer)
  enhanceToastTimer = setTimeout(() => {
    enhanceToast.value = ''
  }, 2000)
}
/** 下一级成本（能量）；满级/不存在返回 null */
const enhanceNextCost = computed<number | null>(() =>
  selectedEnhance.value ? game.relics.nextEnhanceCost(selectedEnhance.value.instanceId) : null
)
const enhanceIsMax = computed(() => (selectedEnhance.value?.level ?? 0) >= MAX_RELIC_LEVEL)
/** 强化后效果（当前级） */
const enhanceCurrentEffects = computed<RelicEffect[]>(() =>
  selectedEnhance.value ? enhancedEffectsOf(selectedEnhance.value) : []
)
/** 下一级效果预览（升到 level+1 的 label） */
const enhanceNextEffects = computed<{ label: string; next: string }[]>(() => {
  const r = selectedEnhance.value
  if (!r || enhanceIsMax.value) return []
  return r.effects.map((eff) => {
    const gain = ENHANCE_GAIN[eff.type]
    if (!gain) return { label: eff.label, next: eff.label }
    return { label: eff.label, next: enhanceLabel(eff.label, eff.value, gain, r.level + 1) }
  })
})
function doEnhance() {
  if (!selectedEnhance.value) return
  const ok = game.relics.enhance(selectedEnhance.value.instanceId)
  if (!ok) showEnhanceToast('能量不足')
}

onUnmounted(() => {
  if (discardTimer) clearTimeout(discardTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (enhanceToastTimer) clearTimeout(enhanceToastTimer)
})
</script>

<template>
  <div class="relic-view">
    <Icons />
    <h2 class="page-title font-display">遗物</h2>
    <p class="page-sub">装备遗物获得永久增益（{{ game.relics.maxSlots }} 个槽位）</p>

    <!-- 装备槽 -->
    <div class="slots-grid">
      <div
        v-for="(slotRelic, idx) in equipped"
        :key="idx"
        class="slot"
        @click="slotRelic && game.relics.unequip(idx)"
      >
        <div
          v-if="slotRelic"
          class="slot-filled"
          :style="{
            '--c': getRarityColor(owned.find((r) => r.instanceId === slotRelic)?.rarity ?? ''),
          }"
        >
          <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
            <use
              :href="'#' + (owned.find((r) => r.instanceId === slotRelic)?.icon ?? 'i-nav-relic')"
            />
          </svg>
          <span class="slot-name">{{ owned.find((r) => r.instanceId === slotRelic)?.name }}</span>
        </div>
        <div v-else class="slot-empty">
          <span>空槽位 {{ idx + 1 }}</span>
        </div>
      </div>
    </div>

    <!-- 合成工坊（v0.61） -->
    <div class="fusion-section" data-testid="fusion-section">
      <h3 class="section-title">合成工坊</h3>
      <p class="fusion-hint">
        点选 3 件同稀有度、未装备的遗物，合成 1 件高一档稀有度的随机遗物（传说为顶档，不可作材料）
      </p>
      <div class="fusion-panel">
        <button
          class="btn-ghost sm select-mode-btn"
          :class="{ on: selectMode }"
          data-testid="select-mode-button"
          @click="toggleSelectMode"
        >
          {{ selectMode ? '✓ 选材中：点击图鉴卡加入材料（再点取消）' : '选择材料' }}
        </button>
        <div class="fusion-slots" data-testid="fusion-slots">
          <div
            v-for="i in 3"
            :key="i"
            class="fusion-slot"
            :class="{ filled: i <= selectedMaterials.length }"
          >
            <template v-if="i <= selectedMaterials.length">
              {{ owned.find((r) => r.instanceId === selectedMaterials[i - 1])?.name }}
            </template>
            <template v-else>材料 {{ i }}</template>
          </div>
        </div>
        <div class="fusion-actions">
          <button
            class="btn-accent sm"
            style="--accent: var(--color-plasma)"
            :disabled="!canSynthesize"
            data-testid="fusion-button"
            @click="doSynthesize"
          >
            合 成
          </button>
          <button v-if="selectedMaterials.length > 0" class="btn-ghost sm" @click="clearSelection">
            清空
          </button>
        </div>
        <p v-if="synthFailMsg" class="fusion-fail">{{ synthFailMsg }}</p>
        <p v-else-if="materialRarity" class="fusion-rarity">
          材料稀有度：{{ RARITY_INFO[materialRarity].name }} → 产物：{{
            NEXT_RARITY_NAME[materialRarity]
          }}
        </p>
      </div>
    </div>

    <!-- 套装（v0.61） -->
    <div class="sets-section" data-testid="sets-section">
      <h3 class="section-title">套装</h3>
      <div class="sets-list">
        <div
          v-for="row in setProgress"
          :key="row.set.id"
          class="set-row"
          :class="{ active: row.mode !== 'none', full: row.mode === 'full' }"
          :style="{ '--c': row.set.color }"
          :data-testid="'set-row-' + row.set.id"
        >
          <div class="set-name">{{ row.set.name }}</div>
          <div class="set-count font-mono">{{ Math.min(row.count, 3) }}/3</div>
          <div class="set-bonus">
            <span v-if="row.mode === 'full'" class="set-bonus-on">{{ row.set.full.label }}</span>
            <span v-else-if="row.mode === 'partial'" class="set-bonus-on">{{
              row.set.partial.label
            }}</span>
            <span v-else class="set-bonus-off"
              >2 件：{{ row.set.partial.label.split('：')[1] }} · 3 件：{{
                row.set.full.label.split('：')[1]
              }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 已装备效果 -->
    <div v-if="equippedRelics.length > 0" class="active-effects">
      <h3 class="section-title">当前效果</h3>
      <div class="effect-list">
        <span v-for="(eff, i) in game.relics.equippedEffects" :key="i" class="eff-tag">{{
          eff.label
        }}</span>
      </div>
    </div>

    <!-- 遗物图鉴 -->
    <div class="inventory">
      <h3 class="section-title">遗物收藏（{{ owned.length }} 件 / {{ ownedKinds }} 种）</h3>
      <div v-if="owned.length === 0" class="empty-inv">
        <EmptyState
          icon="i-nav-relic"
          text="尚未发现遗物"
          hint="探索深层星域有机会获得遗物"
          action="前往探索"
          to="/map"
        />
      </div>
      <div v-else class="relic-list">
        <div
          v-for="r in owned"
          :key="r.instanceId"
          class="relic-card"
          :class="{
            'material-selected': isMaterialSelected(r),
            'material-disabled': !selectable(r),
          }"
          :style="{ '--c': getRarityColor(r.rarity) }"
          @click="onCardClick(r, $event)"
        >
          <div class="r-head">
            <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
              <use :href="'#' + r.icon" />
            </svg>
            <span class="rarity-badge" :style="{ background: getRarityColor(r.rarity) }">{{
              RARITY_INFO[r.rarity].name
            }}</span>
            <span
              v-if="getSetByRelic(r.id)"
              class="set-badge"
              :style="{ color: getSetByRelic(r.id)!.color }"
              :title="getSetByRelic(r.id)!.name"
              >◆</span
            >
          </div>
          <div class="r-name">{{ r.name }}</div>
          <div class="r-desc">{{ r.desc }}</div>
          <div class="r-effects">
            <span v-for="(e, i) in enhancedEffectsOf(r)" :key="i" class="eff-mini">{{
              e.label
            }}</span>
          </div>
          <div v-if="r.level > 0" class="level-badge" data-testid="relic-level-badge">
            Lv{{ r.level }}
          </div>
          <div v-if="game.relics.isEquipped(r.instanceId)" class="equipped-tag">已装备</div>
          <div
            v-if="isMaterialSelected(r)"
            class="material-tag"
            :style="{ background: getRarityColor(r.rarity) }"
          >
            已选为材料
          </div>
          <div class="card-actions">
            <button
              class="btn-ghost sm enhance-btn"
              data-testid="enhance-button"
              @click.stop="openEnhance(r)"
            >
              强化
            </button>
            <button
              class="btn-ghost sm discard-btn"
              :class="{ pending: pendingDiscardId === r.instanceId }"
              :disabled="game.relics.isEquipped(r.instanceId)"
              :title="game.relics.isEquipped(r.instanceId) ? '请先卸下遗物' : ''"
              @click="handleDiscard($event, r)"
            >
              {{
                game.relics.isEquipped(r.instanceId)
                  ? '请先卸下'
                  : pendingDiscardId === r.instanceId
                    ? '确认丢弃？'
                    : '丢弃'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 槽位满提示 toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>

    <!-- 合成产物弹窗 -->
    <ModalOverlay
      :model-value="!!synthResult"
      modal-class="synth-modal"
      aria-label="合成结果"
      @update:model-value="synthResult = null"
      @overlay-click="synthResult = null"
    >
      <template v-if="synthResult">
        <h2 class="result-title font-display">合成成功</h2>
        <p class="result-sub">材料已消耗，获得新遗物</p>
        <div
          class="synth-product"
          :style="{ '--c': getRarityColor(synthResult.rarity) }"
          :data-testid="'synth-product-' + synthResult.rarity"
        >
          <div class="r-head">
            <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
              <use :href="'#' + synthResult.icon" />
            </svg>
            <span class="rarity-badge" :style="{ background: getRarityColor(synthResult.rarity) }">
              {{ RARITY_INFO[synthResult.rarity].name }}
            </span>
          </div>
          <div class="r-name">{{ synthResult.name }}</div>
          <div class="r-effects">
            <span v-for="(e, i) in synthResult.effects" :key="i" class="eff-mini">{{
              e.label
            }}</span>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn-primary" style="flex: 1" @click="synthResult = null">确认</button>
        </div>
      </template>
    </ModalOverlay>
    <!-- 强化面板（v0.70） -->
    <ModalOverlay
      v-if="selectedEnhance"
      :model-value="!!selectedEnhance"
      modal-class="enhance-modal"
      aria-label="遗物强化"
      @update:model-value="selectedEnhance = null"
      @overlay-click="selectedEnhance = null"
    >
      <template v-if="selectedEnhance">
        <h2 class="result-title font-display">遗物强化</h2>
        <div
          class="synth-product"
          :style="{ '--c': getRarityColor(selectedEnhance.rarity) }"
          data-testid="enhance-modal"
        >
          <div class="r-head">
            <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
              <use :href="'#' + selectedEnhance.icon" />
            </svg>
            <span
              class="rarity-badge"
              :style="{ background: getRarityColor(selectedEnhance.rarity) }"
            >
              {{ RARITY_INFO[selectedEnhance.rarity].name }}
            </span>
          </div>
          <div class="r-name">{{ selectedEnhance.name }}</div>
          <div class="enhance-level" data-testid="enhance-level">
            等级：{{ selectedEnhance.level }} / {{ MAX_RELIC_LEVEL }}
          </div>
          <div class="r-effects">
            <span v-for="(e, i) in enhanceCurrentEffects" :key="i" class="eff-mini">{{
              e.label
            }}</span>
          </div>
          <div v-if="!enhanceIsMax && enhanceNextEffects.length > 0" class="enhance-preview">
            <div v-for="(p, i) in enhanceNextEffects" :key="i" class="preview-row">
              <span class="preview-from">{{ p.label }}</span>
              <span class="preview-arrow">→</span>
              <span class="preview-to">{{ p.next }}</span>
            </div>
          </div>
          <div v-if="enhanceIsMax" class="enhance-max">已达上限</div>
          <div v-else class="enhance-cost-row" data-testid="enhance-cost">
            下一级消耗：<span class="font-mono">{{ fmt(enhanceNextCost ?? 0) }}</span> 能量
          </div>
        </div>
        <div class="btn-group">
          <button
            v-if="!enhanceIsMax"
            class="btn-primary"
            style="flex: 1"
            data-testid="enhance-confirm"
            @click="doEnhance"
          >
            强化 ×1
          </button>
          <button class="btn-ghost" style="flex: 1" @click="closeEnhance">关闭</button>
        </div>
      </template>
    </ModalOverlay>

    <!-- 强化能量不足 toast -->
    <Transition name="toast">
      <div v-if="enhanceToast" class="toast">{{ enhanceToast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.relic-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-title {
  color: var(--color-amber);
}

/* —— 合成工坊（v0.61）—— */
.fusion-section {
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-plasma) 40%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.fusion-hint {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.select-mode-btn.on {
  border-color: var(--color-plasma);
  color: var(--color-plasma);
}
.fusion-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.fusion-slots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.fusion-slot {
  aspect-ratio: 2.4;
  border: 1px dashed var(--color-border-line);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  text-align: center;
  padding: var(--space-1);
  overflow: hidden;
}
.fusion-slot.filled {
  border: 1px solid var(--color-plasma);
  color: var(--color-t-primary);
  background: color-mix(in srgb, var(--color-plasma) 10%, transparent);
}
.fusion-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.fusion-fail {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-alert);
}
.fusion-rarity {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}

/* —— 套装（v0.61）—— */
.sets-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.set-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  opacity: 0.6;
}
.set-row.active {
  opacity: 1;
  border-color: var(--c);
}
.set-row.full {
  box-shadow: 0 0 10px color-mix(in srgb, var(--c) 25%, transparent);
}
.set-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c);
  flex-shrink: 0;
}
.set-count {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  flex-shrink: 0;
}
.set-bonus {
  font-size: var(--text-xs);
  flex: 1;
  text-align: right;
}
.set-bonus-on {
  color: var(--c);
}
.set-bonus-off {
  color: var(--color-t-tertiary);
}

/* —— 图鉴卡材料态（v0.61）—— */
.relic-card.material-selected {
  outline: 2px solid var(--color-plasma);
  outline-offset: 1px;
}
.relic-card.material-disabled {
  opacity: 0.55;
}
.set-badge {
  margin-left: auto;
  font-size: var(--text-sm);
}
.material-tag {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-on-core);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-2);
  pointer-events: none;
}
.relic-card {
  position: relative;
}
.synth-modal .result-title {
  color: var(--color-plasma);
}
.synth-product {
  border: 1px solid var(--c);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c) 8%, var(--color-surface));
  padding: var(--space-3);
  margin: var(--space-3) 0;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}
.slot {
  aspect-ratio: 2;
  border: 1px dashed var(--color-border-glow);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--color-surface);
}
.slot-filled {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--c);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c) 10%, var(--color-surface));
}
.slot-name {
  font-size: var(--text-xs);
  font-weight: 600;
}
.slot-empty {
  color: var(--color-locked);
  font-size: var(--text-xs);
} /* P2-7 */

.active-effects {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.effect-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.eff-tag {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 182, 39, 0.1);
  color: var(--color-amber);
  border-radius: var(--radius-sm);
}

.empty-inv {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  text-align: center;
  padding: var(--space-5);
}
.relic-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.relic-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--c);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.r-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
  color: var(--c);
}
.rarity-badge {
  font-size: var(--text-xs);
  padding: 1px var(--space-2);
  border-radius: 3px;
  color: var(--color-void);
  font-weight: 700;
}
.r-name {
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: var(--space-1);
}
.r-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.r-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.eff-mini {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: var(--color-elevated);
  border-radius: 3px;
  color: var(--color-t-primary);
}
.equipped-tag {
  font-size: var(--text-xs);
  color: var(--color-quantum);
  margin-top: var(--space-1);
}
.discard-btn {
  margin-top: var(--space-2);
  border: 1px solid var(--color-border-line);
}
.discard-btn:hover:not(:disabled) {
  border-color: var(--color-alert);
  color: var(--color-alert);
}
.discard-btn.pending {
  border-color: var(--color-alert);
  color: var(--color-alert);
  background: rgba(244, 63, 94, 0.1);
  font-weight: 600;
}

/* —— 强化（v0.70）—— */
.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}
.card-actions .enhance-btn {
  margin-top: var(--space-2);
  border: 1px solid var(--color-border-line);
}
.card-actions .enhance-btn:hover {
  border-color: var(--color-amber);
  color: var(--color-amber);
}
.level-badge {
  display: inline-block;
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-amber);
  background: color-mix(in srgb, var(--color-amber) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
  border-radius: var(--radius-pill);
  padding: 1px var(--space-2);
}
.enhance-level {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
  margin: var(--space-1) 0;
}
.enhance-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: var(--space-2) 0;
}
.preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}
.preview-from {
  color: var(--color-t-tertiary);
  text-decoration: line-through;
}
.preview-arrow {
  color: var(--color-t-tertiary);
}
.preview-to {
  color: var(--color-amber);
  font-weight: 600;
}
.enhance-max {
  font-size: var(--text-sm);
  color: var(--color-amber);
  font-weight: 600;
  margin: var(--space-2) 0;
}
.enhance-cost-row {
  font-size: var(--text-sm);
  color: var(--color-core);
  margin: var(--space-2) 0;
}

/* 槽位满 toast：复用 MapView 同款样式 */
.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  color: var(--color-core);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  pointer-events: none;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
