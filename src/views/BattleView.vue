<script setup lang="ts">
import { t } from '@/i18n'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { getStronghold, STRONGHOLD_TYPES } from '@/data/pve'
import type { StrongholdDef } from '@/data/pve'
import { ENDLESS_STRONGHOLD_ID, MAX_ENDLESS_DEPTH } from '@/data/endless'
import { WEEKLY_BOSS_ID } from '@/data/weekly-boss'
import { getUnit } from '@/data/units'
import Icon from '@/components/ui/Icon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Toast from '@/components/ui/Toast.vue'
import LogList from '@/components/battle/LogList.vue'
import EndlessDepthPanel from '@/components/battle/EndlessDepthPanel.vue'
import FormationPicker from '@/components/battle/FormationPicker.vue'
import BattleResultModal from '@/components/battle/BattleResultModal.vue'
import GarrisonModal from '@/components/battle/GarrisonModal.vue'
import { useBattleFlow } from '@/composables/useBattleFlow'

const route = useRoute()
const router = useRouter()
const game = useGameStore()

const strongholdId = computed(() => route.params.id as string)
/** 是否无尽远征（/battle/endless） */
const isEndless = computed(() => strongholdId.value === ENDLESS_STRONGHOLD_ID)
/** 是否周 Boss（/battle/weekly_boss，v1.24 方案 5） */
const isWeeklyBoss = computed(() => strongholdId.value === WEEKLY_BOSS_ID)

// —— 无尽远征（v0.60）：深度选择 + 按深度合成据点 ——
const endlessDepth = ref(1)
/** 可选深度：1 ~ 前沿（历史最深+1），并封顶于 MAX_ENDLESS_DEPTH；前沿胜利即推进 */
const endlessMaxDepth = computed(() => Math.min(game.combat.expeditionBest + 1, MAX_ENDLESS_DEPTH))
/** 玩家手动调过深度后不再自动跟随前沿（只做越界钳制） */
const endlessTouched = ref(false)
const endlessStrongholdDef = computed<StrongholdDef>(() =>
  game.combat.getEndlessStronghold(endlessDepth.value)
)
function setEndlessDepth(d: number, manual = false) {
  if (manual) endlessTouched.value = true
  endlessDepth.value = Math.max(1, Math.min(endlessMaxDepth.value, Math.floor(d) || 1))
}
function stepEndless(delta: number) {
  setEndlessDepth(endlessDepth.value + delta, true)
}
// 默认跟随前沿（进页/推进后自动对齐到 best+1）；手动选过则只钳制越界
watch(
  endlessMaxDepth,
  (max) => {
    if (!endlessTouched.value) endlessDepth.value = max
    else setEndlessDepth(endlessDepth.value)
  },
  { immediate: true }
)

const stronghold = computed((): StrongholdDef | undefined => {
  if (isEndless.value) return endlessStrongholdDef.value
  // 周 Boss：按终身远征深度 + 本周标识合成（深度实时派生，未击败期间推进上移）
  if (isWeeklyBoss.value) {
    if (!game.combat.isEndlessUnlocked()) return undefined
    return game.combat.getWeeklyBossStronghold(game.combat.expeditionBest, game.daily.currentWeek)
  }
  return getStronghold(strongholdId.value)
})

const selectedFormation = ref(0)

// 编队兜底（v0.81）：注入档/异常档可能编队数不足，选中的下标越界时回退首支，
// 仍无编队（正常档经 storage 自愈后不会发生）时模板层显示空态，不再读 undefined 崩页
const formation = computed(
  () => game.military.formations[selectedFormation.value] ?? game.military.formations[0]
)

// —— v0.82 驻扎/出征校验：据点须解锁且已攻克（远征/周 Boss 分支除外）——
const strongholdUnlocked = computed(() => {
  if (isEndless.value) return game.combat.isEndlessUnlocked()
  // 周 Boss：解锁口径与远征入口一致（本轮已克 silencer_3）
  if (isWeeklyBoss.value) return game.combat.isEndlessUnlocked()
  const def = getStronghold(strongholdId.value)
  if (!def) return false
  return game.exploration.prereqMet(def.requires)
})
/** 已攻克：正式据点须在通关集内（未攻克可出战但不可驻扎；合成据点无驻扎语义） */
const strongholdConquered = computed(
  () => isEndless.value || game.combat.completedStrongholds.has(strongholdId.value)
)

// 编队详情（含兵种名和数量）
interface FormationUnitRow {
  unitId: string
  name: string
  count: number
}
const formationRows = computed<FormationUnitRow[]>(() => {
  const f = formation.value
  if (!f) return []
  return (Object.keys(f.units) as Array<keyof typeof f.units>)
    .map((uid) => {
      const def = getUnit(uid)
      return { unitId: uid, name: def?.name ?? uid, count: f.units[uid] }
    })
    .filter((r) => r.count > 0)
})
const isFormationEmpty = computed(() => formationRows.value.length === 0)

/** 选中编队是否在途派遣（v1.27 方案 6 锁定面：禁出战与驻扎） */
const formationDispatched = computed(() =>
  formation.value ? game.military.isDispatched(formation.value.id) : false
)

/** 出征禁用 = 编队空或据点未解锁或编队派遣中；周 Boss 追加「本周已击败」禁用（防重复领取） */
const battleDisabled = computed(
  () =>
    isFormationEmpty.value ||
    !strongholdUnlocked.value ||
    formationDispatched.value ||
    (isWeeklyBoss.value && bossFlow.isWeeklyBossDefeated.value)
)
/** 驻扎禁用 = 编队空或据点未攻克或编队派遣中 */
const garrisonDisabled = computed(
  () => isFormationEmpty.value || !strongholdConquered.value || formationDispatched.value
)

// —— 战斗流程状态机：战斗执行 / 结果弹窗 / 驻扎（useBattleFlow）——
const bossFlow = useBattleFlow({
  strongholdId,
  stronghold,
  formation,
  isEndless,
  endlessDepth,
  isWeeklyBoss,
})
const {
  battleLog,
  battleResult,
  showResult,
  showGarrisonConfirm,
  isGarrisoned,
  garrisonPreview,
  toast,
  startBattle,
  confirmResult,
  stayHere,
  toggleGarrison,
  confirmGarrison,
  cancelGarrison,
} = bossFlow
</script>

<template>
  <div v-if="stronghold" class="battle-view">
    <button class="back-btn" @click="router.push('/map')">← {{ t('battle.backToMap') }}</button>

    <!-- 据点信息 -->
    <div class="stronghold-info" :style="{ '--c': STRONGHOLD_TYPES[stronghold.type].color }">
      <div class="s-icon">
        <Icon :name="STRONGHOLD_TYPES[stronghold.type].icon" size="lg" />
      </div>
      <div>
        <h2 class="s-name font-display">{{ stronghold.name }}</h2>
        <p class="s-type">
          {{ STRONGHOLD_TYPES[stronghold.type].name
          }}<template v-if="!isEndless"> · Tier {{ stronghold.tier }}</template>
        </p>
        <p class="s-desc">{{ stronghold.desc }}</p>
      </div>
    </div>

    <!-- 无尽远征：深度选择（仅 /battle/endless；周 Boss 深度锚定前沿不可手选） -->
    <EndlessDepthPanel
      v-if="isEndless"
      :depth="endlessDepth"
      :max-depth="endlessMaxDepth"
      @step="stepEndless"
    />

    <!-- 敌方信息 -->
    <div>
      <h3 class="section-title">{{ t('battle.enemyDeployment') }}</h3>
      <div class="enemy-list">
        <div v-for="(e, i) in stronghold.enemies" :key="i" class="enemy-card">
          <div class="e-name">{{ e.name }}</div>
          <div class="e-stats">
            <span class="stat">{{ t('common.statAttack') }} {{ fmt(e.attack) }}</span>
            <span class="stat">{{ t('common.statDefense') }} {{ fmt(e.defense) }}</span>
            <span class="stat">HP {{ fmt(e.hp) }}</span>
            <span class="stat count">×{{ e.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编队选择 -->
    <FormationPicker
      :selected="selectedFormation"
      :rows="formationRows"
      :empty="isFormationEmpty"
      :unlocked="strongholdUnlocked"
      :is-endless="isEndless"
      @select="selectedFormation = $event"
    />

    <!-- 点击反馈 toast（战损/驻扎提示） -->
    <Toast :toast="toast" />

    <!-- 操作：驻扎按钮仅正式据点（远征/周 Boss 合成据点无占领语义） -->
    <div class="actions">
      <button
        class="btn-accent"
        style="flex: 2; --accent: var(--color-alert)"
        :disabled="battleDisabled"
        data-testid="battle-start"
        @click="startBattle"
      >
        <Icon name="i-ui-sword" size="md" />
        {{
          formationDispatched
            ? t('battle.deployBlockedDispatch')
            : isWeeklyBoss && bossFlow.isWeeklyBossDefeated.value
              ? t('battle.weeklyBossDefeated')
              : t('battle.deploy')
        }}
      </button>
      <button
        v-if="!isEndless && !isWeeklyBoss"
        class="btn-secondary"
        :class="{ 'garrison-active': isGarrisoned }"
        style="flex: 1"
        :disabled="garrisonDisabled"
        data-testid="battle-garrison"
        @click="toggleGarrison"
      >
        {{ isGarrisoned ? t('battle.withdrawGarrison') : t('battle.garrison') }}
      </button>
    </div>

    <!-- 战斗日志 -->
    <div v-if="battleLog && !showResult" class="battle-log">
      <h3 class="section-title">{{ t('battle.logTitle') }}</h3>
      <LogList class="log-list" :entries="battleLog" />
    </div>

    <!-- 结果弹窗 -->
    <BattleResultModal
      :show="showResult"
      :result="battleResult"
      :log="battleLog"
      @stay="stayHere"
      @confirm="confirmResult"
    />

    <!-- 驻扎确认弹窗 -->
    <GarrisonModal
      :show="showGarrisonConfirm"
      :stronghold-name="stronghold.name"
      :preview="garrisonPreview"
      @cancel="cancelGarrison"
      @confirm="confirmGarrison"
    />
  </div>
  <EmptyState
    v-else
    icon="i-nav-explore"
    :text="t('battle.noStronghold')"
    :hint="t('battle.noStrongholdHint')"
    :action="t('battle.backToMap')"
    to="/map"
  />
</template>

<style scoped>
.battle-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.back-btn {
  align-self: flex-start;
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
  padding: var(--space-2) var(--space-3);
}

.stronghold-info {
  display: flex;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--c);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.s-icon {
  color: var(--c);
  flex-shrink: 0;
}
.s-name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--c);
}
.s-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-top: var(--space-1);
}

.enemy-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.enemy-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.e-name {
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: var(--space-1);
}
.e-stats {
  display: flex;
  gap: var(--space-2);
}
.stat {
  border-radius: var(--radius-xs);
}
.stat.count {
  color: var(--color-alert);
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.garrison-active {
  background: var(--color-quantum) !important;
  color: var(--color-on-core) !important;
  border-color: var(--color-quantum) !important;
}

.battle-log {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.log-list {
  max-height: 300px;
  overflow-y: auto;
}
</style>
