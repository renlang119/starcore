<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { RARITY_INFO, getSetByRelic, relicRarityColor } from '@/data/relics'
import { enhancedEffectsOf, type OwnedRelic } from '@/stores/relics'
import { useRelicFusion } from '@/composables/useRelicFusion'
import { useToast } from '@/composables/useToast'
import { useTimeout } from '@/composables/useTimeout'
import EmptyState from '@/components/ui/EmptyState.vue'
import Toast from '@/components/ui/Toast.vue'
import Icon from '@/components/ui/Icon.vue'
import FusionPanel from '@/components/relics/FusionPanel.vue'
import EnhanceModal from '@/components/relics/EnhanceModal.vue'

const game = useGameStore()

// —— 槽位满提示 toast（合成混选拒绝复用同一实现，v0.73 收敛至 useToast） ——
const toast = useToast()

// —— 合成工坊（v0.61）：状态在 composable，选材点击发生在图鉴卡上 ——
const fusion = useRelicFusion({ notify: toast.show })

/** 装备槽视图行：一次性解析遗物实例与展示字段（替代三处 owned.find 扫描） */
const slotRows = computed(() =>
  game.relics.equipped.map((id, idx) => {
    const relic = id ? (game.relics.owned.find((r) => r.instanceId === id) ?? null) : null
    return {
      idx,
      relic,
      color: relic ? relicRarityColor(relic.rarity) : '',
      label: !id ? `空槽位 ${idx + 1}` : relic ? `卸下 ${relic.name}` : '卸下该槽位遗物',
    }
  })
)

/** 图鉴卡主操作按钮：装备到首个空槽（选材模式下主操作由选材按钮承担） */
function equipFromCard(r: OwnedRelic) {
  equip(
    r,
    game.relics.equipped.findIndex((s) => s === null)
  )
}

/** 选材模式开关态（模板用，fusion 返回的普通对象内 ref 不自动解套） */
const selectModeOn = computed(() => fusion.selectMode.value)

/** 装备槽激活：卸下该槽位遗物（空槽无操作） */
function onSlotActivate(idx: number) {
  if (game.relics.equipped[idx]) game.relics.unequip(idx)
}

function equip(relic: OwnedRelic, slot: number) {
  // 槽位全满时 findIndex 返回 -1，需明确提示玩家
  if (slot < 0) {
    toast.show('装备槽位已满，请先卸下一个遗物')
    return
  }
  if (game.relics.equipped[slot] === relic.instanceId) {
    game.relics.unequip(slot)
  } else {
    game.relics.equip(relic.instanceId, slot)
  }
}

const getRarityColor = relicRarityColor

// —— 丢弃功能（两次点击确认） ——
const pendingDiscardId = ref<string | null>(null)
const discardTimer = useTimeout()

function handleDiscard(e: Event, relic: OwnedRelic) {
  e.stopPropagation()
  // 正在装备中的遗物不允许直接丢弃
  if (game.relics.isEquipped(relic.instanceId)) return
  if (pendingDiscardId.value === relic.instanceId) {
    // 第二次点击 → 确认丢弃
    game.relics.discard(relic.instanceId)
    pendingDiscardId.value = null
    discardTimer.clear()
  } else {
    // 第一次点击 → 进入待确认状态
    pendingDiscardId.value = relic.instanceId
    discardTimer.set(() => {
      pendingDiscardId.value = null
    }, 3000)
  }
}

// —— 强化（v0.70）：面板内聚于 EnhanceModal，此处只持开关与失败 toast ——
const selectedEnhance = ref<OwnedRelic | null>(null)

function openEnhance(r: OwnedRelic) {
  selectedEnhance.value = r
}

function onEnhanceFail(msg: string) {
  toast.show(msg)
}
</script>

<template>
  <div class="relic-view">
    <h2 class="page-title font-display">遗物</h2>
    <p class="page-sub">装备遗物获得永久增益（{{ game.relics.maxSlots }} 个槽位）</p>

    <!-- 装备槽 -->
    <div class="slots-grid">
      <div
        v-for="row in slotRows"
        :key="row.idx"
        class="slot"
        role="button"
        :tabindex="row.relic ? 0 : -1"
        :aria-label="row.label"
        @click="onSlotActivate(row.idx)"
        @keydown.enter="onSlotActivate(row.idx)"
        @keydown.space.prevent="onSlotActivate(row.idx)"
      >
        <div v-if="row.relic" class="slot-filled" :style="{ '--c': row.color }">
          <Icon :name="row.relic.icon" size="lg" />
          <span class="slot-name">{{ row.relic.name }}</span>
        </div>
        <div v-else class="slot-empty">
          <span>空槽位 {{ row.idx + 1 }}</span>
        </div>
      </div>
    </div>

    <!-- 合成工坊 + 产物弹窗（v0.72 拆出） -->
    <FusionPanel :fusion="fusion" />

    <!-- 套装（v0.61） -->
    <div data-testid="sets-section">
      <h3 class="section-title">套装</h3>
      <div class="sets-list">
        <div
          v-for="row in game.relics.setProgress"
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
              >2 件：{{ row.set.partial.short }} · 3 件：{{ row.set.full.short }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 已装备效果 -->
    <div v-if="game.relics.equippedRelics.length > 0" class="active-effects">
      <h3 class="section-title">当前效果</h3>
      <div class="effect-list">
        <span v-for="(eff, i) in game.relics.equippedEffects" :key="i" class="eff-tag">{{
          eff.label
        }}</span>
      </div>
    </div>

    <!-- 遗物图鉴 -->
    <div class="inventory">
      <h3 class="section-title">
        遗物收藏（{{ game.relics.owned.length }} 件 / {{ game.relics.ownedKinds }} 种）
      </h3>
      <div v-if="game.relics.owned.length === 0" class="empty-inv">
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
          v-for="r in game.relics.owned"
          :key="r.instanceId"
          class="relic-card"
          :class="{
            'material-selected': fusion.isMaterialSelected(r),
            'material-disabled': !fusion.selectable(r),
          }"
          :style="{ '--c': getRarityColor(r.rarity) }"
        >
          <div class="r-head">
            <Icon :name="r.icon" size="md" />
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
            v-if="fusion.isMaterialSelected(r)"
            class="material-tag"
            :style="{ background: getRarityColor(r.rarity) }"
          >
            已选为材料
          </div>
          <div class="card-actions">
            <button
              v-if="selectModeOn"
              class="btn-ghost sm select-btn"
              data-testid="select-material-button"
              :disabled="!fusion.selectable(r) && !fusion.isMaterialSelected(r)"
              @click.stop="fusion.toggleMaterial(r)"
            >
              {{ fusion.isMaterialSelected(r) ? '取消选材' : '选为材料' }}
            </button>
            <button
              v-else
              class="btn-ghost sm equip-btn"
              data-testid="equip-button"
              :disabled="game.relics.isEquipped(r.instanceId)"
              @click.stop="equipFromCard(r)"
            >
              {{ game.relics.isEquipped(r.instanceId) ? '已装备' : '装备' }}
            </button>
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

    <!-- 槽位满/合成混选/强化失败提示 toast -->
    <Toast :toast="toast" />

    <!-- 强化面板（v0.70，v0.72 拆出） -->
    <EnhanceModal
      v-if="selectedEnhance"
      :key="selectedEnhance.instanceId"
      :relic="selectedEnhance"
      @close="selectedEnhance = null"
      @fail="onEnhanceFail"
    />
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

/* —— 图鉴卡 —— */
.relic-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--c);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  transition:
    transform 0.2s var(--ease-out),
    box-shadow 0.2s var(--ease-out);
}
.relic-card:not(.material-disabled):hover {
  transform: translateY(-2px);
  box-shadow: var(--elevation-2);
}
.relic-card:not(.material-disabled):active {
  transform: translateY(0) scale(0.98);
  transition: transform 0.1s var(--ease-out);
}
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
  background: color-mix(in srgb, var(--color-amber) 10%, transparent);
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
.r-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
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
  background: color-mix(in srgb, var(--color-alert) 10%, transparent);
  font-weight: 600;
}

/* —— 卡面操作按钮（v0.70 强化入口，v0.96 主操作平铺为显式按钮）—— */
.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}
.card-actions .equip-btn,
.card-actions .select-btn {
  margin-top: var(--space-2);
  border: 1px solid var(--color-border-line);
}
.card-actions .equip-btn:hover:not(:disabled),
.card-actions .select-btn:hover:not(:disabled) {
  border-color: var(--color-core);
  color: var(--color-core);
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

/* 槽位满 toast：样式已收敛至全局 styles/toast.css（v0.73） */
</style>
