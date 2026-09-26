<script setup lang="ts">
/**
 * DispatchPanel.vue — 编队派遣区（v1.27 可玩内容扩展方案 6）。
 *
 * 职责：渲染每编队卡的派遣状态与操作（未解锁 / 未派遣 / 派遣中三态）。
 * 锁定面：派遣中编队的战斗/驻扎/编入撤出入口由宿主各页禁用，
 * 本组件只负责派遣自身状态。
 */
import { t } from '@/i18n'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { DISPATCH_TIERS, dispatchRewardPreview, getDispatchTier } from '@/data/dispatch'
import { resourceRows } from '@/lib/resource-rows'
import { fmtTime } from '@/lib/format'
import { useToast } from '@/composables/useToast'
import Toast from '@/components/ui/Toast.vue'

const props = defineProps<{ formationId: string }>()

const game = useGameStore()
const toast = useToast()

const unlocked = computed(() => game.military.dispatchUnlocked)
const dispatch = computed(() => game.military.dispatches[props.formationId])

/** 选中档位（小时）；派遣中读在途档位 */
const selectedHours = ref<number>(DISPATCH_TIERS[0].hours)

/** 每秒跳动的「现在」（倒计时用） */
const nowTick = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
timer = setInterval(() => {
  nowTick.value = Date.now()
}, 1000)
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const endTime = computed(() =>
  dispatch.value ? dispatch.value.startTime + dispatch.value.hours * 3_600_000 : 0
)
const remainSec = computed(() =>
  dispatch.value ? Math.max(0, Math.round((endTime.value - nowTick.value) / 1000)) : 0
)
const isReady = computed(() => !!dispatch.value && remainSec.value <= 0)

/** 预览：当前档位（派遣前）或全额（派遣中，召回到账即此值） */
const previewRows = computed(() => {
  const trait = game.military.formations.find((f) => f.id === props.formationId)?.trait
  const tier = getDispatchTier(dispatch.value?.hours ?? selectedHours.value)
  if (!tier) return []
  const r = dispatchRewardPreview(game.combat.expeditionBest, tier.weight, trait)
  return resourceRows(r as never, game.resources.allMeta, { positiveOnly: true })
})

function send() {
  if (!game.military.startDispatch(props.formationId, selectedHours.value, Date.now())) {
    toast.show(t('army.dispatchBusy'), 2500)
    return
  }
}

/** 召回：完成前按 t/H 比例结算，完成态停走后仍可召回（全额发放） */
function recall() {
  const r = game.military.recallDispatch(props.formationId, Date.now())
  if (!r) return
  for (const [key, value] of Object.entries(r.reward)) {
    if (value > 0) game.resources.gain(key as never, value)
  }
  const rows = resourceRows(r.reward as never, game.resources.allMeta, { positiveOnly: true })
  const changes =
    rows.length === 0
      ? t('ui.encounter.nothing')
      : rows.map((x) => `${x.amount} ${x.name}`).join(' + ')
  toast.show(t('ui.encounter.resolved', { name: t('army.dispatchTitle'), changes }), 3200)
}
</script>

<template>
  <div class="f-dispatch" :data-testid="`dispatch-${formationId}`">
    <div class="fd-head">
      <span class="fd-title">{{ t('army.dispatchTitle') }}</span>
      <span
        v-if="dispatch"
        class="fd-state"
        :class="{ ready: isReady }"
        :data-testid="`dispatch-state-${formationId}`"
      >
        {{
          isReady
            ? t('army.dispatchReady')
            : t('army.dispatchReturnIn', { time: fmtTime(remainSec) })
        }}
      </span>
    </div>

    <!-- 未解锁：提示语 -->
    <div v-if="!unlocked" class="fd-locked" data-testid="dispatch-locked">
      {{ t('army.dispatchLocked') }}
    </div>

    <!-- 派遣中：倒计时 + 召回 -->
    <template v-else-if="dispatch">
      <div class="fd-rows">
        <div v-for="row in previewRows" :key="row.id" class="fd-row">
          <span>{{ row.name }}</span>
          <span class="font-mono">{{ row.amount }}</span>
        </div>
      </div>
      <button
        class="fd-btn"
        :class="{ ready: isReady }"
        :data-testid="`dispatch-recall-${formationId}`"
        @click.stop="recall"
      >
        {{ isReady ? t('army.dispatchRecall') : t('army.dispatchRecallEarly') }}
      </button>
      <div v-if="!isReady" class="fd-note">{{ t('army.dispatchRecallNote') }}</div>
    </template>

    <!-- 未派遣：档位选择 + 预览 + 派出 -->
    <template v-else>
      <div class="fd-seg" role="radiogroup" :aria-label="t('army.dispatchTitle')">
        <button
          v-for="tier in DISPATCH_TIERS"
          :key="tier.hours"
          class="seg-btn"
          :class="{ active: selectedHours === tier.hours }"
          role="radio"
          :aria-checked="selectedHours === tier.hours"
          :data-testid="`dispatch-tier-${formationId}-${tier.hours}`"
          @click.stop="selectedHours = tier.hours"
        >
          {{ tier.label }}
        </button>
      </div>
      <div class="fd-rows">
        <div class="fd-preview">{{ t('army.dispatchPreview') }}</div>
        <div v-for="row in previewRows" :key="row.id" class="fd-row">
          <span>{{ row.name }}</span>
          <span class="font-mono">{{ row.amount }}</span>
        </div>
      </div>
      <button class="fd-btn" :data-testid="`dispatch-send-${formationId}`" @click.stop="send">
        {{ t('army.dispatchSend') }}
      </button>
    </template>
    <!-- 召回/派出失败回执（本实例须自行挂载，useToast 非单例；与 AppShell 全局回执 toast 并存、互不共用） -->
    <Toast :toast="toast" />
  </div>
</template>

<style scoped>
.f-dispatch {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border-line);
}
.fd-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.fd-title {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.fd-state {
  font-size: var(--text-xs);
  color: var(--color-plasma);
  font-variant-numeric: tabular-nums;
}
.fd-state.ready {
  color: var(--color-quantum);
}
.fd-locked {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-locked);
}
.fd-seg {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-2);
}
.fd-rows {
  margin-top: var(--space-2);
  display: grid;
  gap: 2px;
}
.fd-preview {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
}
.fd-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.fd-btn {
  margin-top: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-elevated);
  border: 1px solid var(--color-border-line);
  color: var(--color-t-primary);
  font-size: var(--text-sm);
}
.fd-btn.ready {
  background: var(--color-quantum);
  color: var(--color-on-core);
  border-color: var(--color-quantum);
}
.fd-note {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
}
</style>
