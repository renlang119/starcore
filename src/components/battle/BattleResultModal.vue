<script setup lang="ts">
/**
 * BattleResultModal.vue — 战斗结果弹窗（从 BattleView 拆出）。
 *
 * 胜败标题、战利品（含遗物掉落）、损失与战报日志；弹窗交互结果经
 * stay / confirm 事件交回父层（遮罩点击与按钮同语义：胜利留在原地、
 * 失败确认返回）。类名与文案保持不变。
 */
import { t } from '@/i18n'
import { computed } from 'vue'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'
import LogList from '@/components/battle/LogList.vue'
import { resourceRows } from '@/lib/resource-rows'
import { getUnit } from '@/data/units'
import type { UnitId } from '@/data/units'
import { RARITY_INFO, relicRarityColor } from '@/data/relics'
import { useGameStore } from '@/stores/game'
import type { BattleLogEntry } from '@/stores/combat'
import type { BattleResult } from '@/composables/useBattleFlow'

const props = defineProps<{
  /** 是否显示弹窗 */
  show: boolean
  /** 战斗结果（null 时按失败态空渲染，与原逻辑一致） */
  result: BattleResult | null
  /** 战报日志 */
  log: BattleLogEntry[] | null
}>()

const emit = defineEmits<{ stay: []; confirm: [] }>()

const game = useGameStore()

// —— 结果展示派生（奖励 / 损失 / 无损失）——
const rewardRows = computed(() => {
  if (!props.result?.rewards) return []
  return resourceRows(props.result.rewards, game.resources.allMeta, { positiveOnly: true })
})
const lossRows = computed(() => {
  if (!props.result?.losses) return []
  return Object.entries(props.result.losses)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ key: k, name: getUnit(k as UnitId)?.name ?? k, count: v as number }))
})
const hasNoLoss = computed(
  () => props.result && Object.values(props.result.losses).every((v) => !v)
)
</script>

<template>
  <ModalOverlay
    :model-value="show"
    :modal-class="{ victory: result?.victory === true, defeat: !result?.victory }"
    :aria-label="result?.victory ? t('battle.resultWin') : t('battle.resultLoss')"
    @overlay-click="result?.victory ? emit('stay') : emit('confirm')"
  >
    <h2 class="result-title font-display">
      {{ result?.victory ? t('battle.titleVictory') : t('battle.titleDefeat') }}
    </h2>
    <p class="result-sub">
      {{ result?.victory ? t('battle.strongholdCaptured') : t('battle.repelled') }}
    </p>

    <div v-if="result?.victory" class="result-rewards">
      <h4>{{ t('battle.spoils') }}</h4>
      <div v-for="r in rewardRows" :key="r.id" class="reward-row">
        <span>{{ r.name }}</span>
        <span class="font-mono" style="color: var(--color-quantum)">+{{ r.amount }}</span>
      </div>
      <div v-if="result.relic" class="relic-drop">
        <span class="rarity-tag" :style="{ color: relicRarityColor(result.relic.rarity) }">
          🎁
          {{
            t('battle.relicGainedLine', {
              name: result.relic.name,
              rarity: RARITY_INFO[result.relic.rarity].name,
            })
          }}
        </span>
      </div>
    </div>

    <div v-if="result?.losses" class="result-losses">
      <h4>{{ t('battle.losses') }}</h4>
      <div v-for="l in lossRows" :key="l.key" class="loss-row">
        <span>{{ l.name }}</span>
        <span class="font-mono" style="color: var(--color-alert)">-{{ l.count }}</span>
      </div>
      <div v-if="hasNoLoss" class="no-loss">{{ t('battle.noLosses') }}</div>
    </div>

    <!-- 战报日志（整合进弹窗，胜败均可见） -->
    <div v-if="log && log.length" class="result-log">
      <h4>{{ t('battle.report') }}</h4>
      <LogList class="modal-log-list" :entries="log" />
    </div>

    <div class="btn-group">
      <button v-if="result?.victory" class="btn-primary" style="flex: 2" @click="emit('stay')">
        {{ t('battle.stay') }}
      </button>
      <button class="btn-secondary" style="flex: 1" @click="emit('confirm')">
        {{ result?.victory ? t('battle.backToMap') : t('common.confirm') }}
      </button>
    </div>
  </ModalOverlay>
</template>

<style scoped>
/* 弹窗本体挂载在 ModalOverlay 内部（只带 ModalOverlay 的 data-v），
   本组件 scoped 规则须经 :deep() 穿透才能命中（v0.77 RelicView 同源坑补齐） */
:deep(.modal.victory) {
  border-color: var(--color-quantum);
  box-shadow: 0 0 40px color-mix(in srgb, var(--color-quantum) 20%, transparent);
}
:deep(.modal.defeat) {
  border-color: var(--color-alert);
  box-shadow: 0 0 40px color-mix(in srgb, var(--color-alert) 20%, transparent);
}
.result-title {
  font-size: var(--text-xl);
  font-weight: 900;
  text-align: center;
  margin-bottom: var(--space-1);
}
:deep(.modal.victory) .result-title {
  color: var(--color-quantum);
}
:deep(.modal.defeat) .result-title {
  color: var(--color-alert);
}
.result-sub {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  text-align: center;
  margin-bottom: var(--space-4);
}
.result-rewards,
.result-losses {
  margin-bottom: var(--space-4);
}
.result-rewards h4,
.result-losses h4 {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.reward-row,
.loss-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  font-size: var(--text-sm);
}
.relic-drop {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--color-elevated);
  border-radius: var(--radius-md);
  text-align: center;
}
.rarity-tag {
  font-size: var(--text-sm);
  font-weight: 600;
}
.no-loss {
  font-size: var(--text-xs);
  color: var(--color-quantum);
}
.result-log {
  margin-bottom: var(--space-4);
}
.result-log h4 {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.modal-log-list {
  max-height: 180px;
  overflow-y: auto;
  background: var(--color-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}
.btn-group {
  display: flex;
  gap: var(--space-2);
}
</style>
