<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { RARITY_INFO } from '@/data/relics'
import type { OwnedRelic } from '@/stores/relics'
import Icons from '@/components/ui/Icons.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const game = useGameStore()

const owned = computed(() => game.relics.owned)
const equipped = computed(() => game.relics.equipped)
const equippedRelics = computed(() => game.relics.equippedRelics)

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
      <h3 class="section-title">遗物收藏（{{ owned.length }}）</h3>
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
          :style="{ '--c': getRarityColor(r.rarity) }"
          @click="
            equip(
              r,
              equipped.findIndex((s) => s === null)
            )
          "
        >
          <div class="r-head">
            <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
              <use :href="'#' + r.icon" />
            </svg>
            <span class="rarity-badge" :style="{ background: getRarityColor(r.rarity) }">{{
              RARITY_INFO[r.rarity].name
            }}</span>
          </div>
          <div class="r-name">{{ r.name }}</div>
          <div class="r-desc">{{ r.desc }}</div>
          <div class="r-effects">
            <span v-for="(e, i) in r.effects" :key="i" class="eff-mini">{{ e.label }}</span>
          </div>
          <div v-if="game.relics.isEquipped(r.instanceId)" class="equipped-tag">已装备</div>
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

    <!-- 槽位满提示 toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
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
