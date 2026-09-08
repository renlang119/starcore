<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { RARITY_INFO, getSetByRelic } from '@/data/relics'
import { enhancedEffectsOf, type OwnedRelic } from '@/stores/relics'
import { useRelicFusion } from '@/composables/useRelicFusion'
import Icons from '@/components/ui/Icons.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FusionPanel from '@/components/relics/FusionPanel.vue'
import EnhanceModal from '@/components/relics/EnhanceModal.vue'

const game = useGameStore()

const owned = computed(() => game.relics.owned)
const equipped = computed(() => game.relics.equipped)
const equippedRelics = computed(() => game.relics.equippedRelics)
const setProgress = computed(() => game.relics.setProgress)
const ownedKinds = computed(() => game.relics.ownedKinds)

// —— 槽位满提示 toast（合成混选拒绝复用同一实现，v0.72） ——
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 2000)
}

// —— 合成工坊（v0.61）：状态在 composable，选材点击发生在图鉴卡上 ——
const fusion = useRelicFusion({ notify: showToast })

/** 图鉴卡点击：点在丢弃按钮上不劫持；选材模式下点卡=选材料，否则=装备 */
function onCardClick(r: OwnedRelic, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.discard-btn')) return
  if (fusion.selectMode.value) {
    fusion.toggleMaterial(r)
    return
  }
  equip(
    r,
    equipped.value.findIndex((s) => s === null)
  )
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

// —— 强化（v0.70）：面板内聚于 EnhanceModal，此处只持开关与失败 toast ——
const selectedEnhance = ref<OwnedRelic | null>(null)

function openEnhance(r: OwnedRelic) {
  selectedEnhance.value = r
}

function onEnhanceFail(msg: string) {
  showToast(msg)
}

onUnmounted(() => {
  if (discardTimer) clearTimeout(discardTimer)
  if (toastTimer) clearTimeout(toastTimer)
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

    <!-- 合成工坊 + 产物弹窗（v0.72 拆出） -->
    <FusionPanel :fusion="fusion" />

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
            'material-selected': fusion.isMaterialSelected(r),
            'material-disabled': !fusion.selectable(r),
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
            v-if="fusion.isMaterialSelected(r)"
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

    <!-- 槽位满/合成混选/强化失败提示 toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>

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

/* —— 强化入口（v0.70）—— */
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
