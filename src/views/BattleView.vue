<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { getStronghold, STRONGHOLD_TYPES } from '@/data/pve'
import type { StrongholdDef } from '@/data/pve'
import { ENDLESS_STRONGHOLD_ID } from '@/data/endless'
import { getUnit } from '@/data/units'
import type { UnitId } from '@/data/units'
import type { ResourceType } from '@/data/buildings'
import Icons from '@/components/ui/Icons.vue'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'

const route = useRoute()
const router = useRouter()
const game = useGameStore()

const strongholdId = computed(() => route.params.id as string)
/** 是否无尽远征（/battle/endless） */
const isEndless = computed(() => strongholdId.value === ENDLESS_STRONGHOLD_ID)

// —— 无尽远征（v0.60）：深度选择 + 按深度合成据点 ——
const endlessDepth = ref(1)
const endlessBest = computed(() => game.combat.expeditionBest)
/** 可选深度：1 ~ 前沿（历史最深+1），前沿胜利即推进 */
const endlessMaxDepth = computed(() => endlessBest.value + 1)
/** 用户手动调过深度后不再自动跟随前沿（只做越界钳制） */
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

const stronghold = computed((): StrongholdDef | undefined =>
  isEndless.value ? endlessStrongholdDef.value : getStronghold(strongholdId.value)
)

const selectedFormation = ref(0)
const battleLog = ref<any[] | null>(null)
const battleResult = ref<any | null>(null)
const showResult = ref(false)
const showGarrisonConfirm = ref(false)
const rewardsGranted = ref(false) // 防止奖励重复发放

const formation = computed(() => game.military.formations[selectedFormation.value])

const isGarrisoned = computed(() => !!game.combat.garrisoned[strongholdId.value])

// 驻扎收益预览（每秒 + 每小时）
const garrisonPreview = computed(() => {
  const idle = game.combat.garrisonIdleReward(strongholdId.value)
  const metaMap = game.resources.allMeta
  return Object.entries(idle)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const meta = metaMap[k]
      const perSec = v as number
      const perHour = perSec * 3600
      return {
        id: k,
        name: meta?.name ?? k,
        color: meta?.color ?? '#fff',
        perSec: fmt(perSec),
        perHour: fmt(perHour),
      }
    })
})

// 编队详情（含兵种名和数量）
interface FormationUnitRow {
  unitId: string
  name: string
  count: number
}
const formationRows = computed<FormationUnitRow[]>(() => {
  const f = formation.value
  return (Object.keys(f.units) as Array<keyof typeof f.units>)
    .map((uid) => {
      const def = getUnit(uid)
      return { unitId: uid, name: def?.name ?? uid, count: f.units[uid] }
    })
    .filter((r) => r.count > 0)
})
const isFormationEmpty = computed(() => formationRows.value.length === 0)

// 战斗结果展示数据
const rewardRows = computed(() => {
  if (!battleResult.value?.rewards) return []
  const metaMap = game.resources.allMeta
  return Object.entries(battleResult.value.rewards)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ key: k, name: metaMap[k]?.name ?? k, amount: fmt(v as number) }))
})
const lossRows = computed(() => {
  if (!battleResult.value?.losses) return []
  return Object.entries(battleResult.value.losses)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ key: k, name: getUnit(k as UnitId)?.name ?? k, count: v as number }))
})
const hasNoLoss = computed(
  () => battleResult.value && Object.values(battleResult.value.losses).every((v) => !v)
)

function startBattle() {
  if (!stronghold.value) return
  rewardsGranted.value = false // 新战斗重置发放标志
  const result = game.combat.resolveBattle(
    formation.value,
    stronghold.value,
    game.atkMult,
    game.defMult
  )
  battleLog.value = result.log
  battleResult.value = result
  showResult.value = true
  // 无尽远征：攻克当前前沿 → 推进历史最深深度（待奖励发放时执行，见 grantRewards）
  // 成就终身计数：据点攻克（胜利）次数（远征战果同样计入战斗里程碑）
  if (result.victory) {
    game.achievements.recordBattle()
    game.achievements.checkAndUnlock()
    game.daily.bump('battles')
  }
  // 奖励发放推迟到 confirmResult/stayHere 时
}

/** 发放战斗奖励（仅在用户确认弹窗结果时调用，通过 rewardsGranted 防重入） */
function grantRewards() {
  if (rewardsGranted.value) return
  const r = battleResult.value
  if (!r?.victory) return
  rewardsGranted.value = true
  for (const [k, v] of Object.entries(r.rewards)) {
    if (v) game.resources.gain(k as ResourceType, v as number)
  }
  if (r.relic) game.relics.obtain(r.relic)
  // 远征：奖励落袋的同时记录战果（攻克当前前沿才推进，重打不推进）
  if (isEndless.value) {
    game.combat.recordExpedition(endlessDepth.value, true)
  }
}

function confirmResult() {
  grantRewards()
  showResult.value = false
  if (battleResult.value?.victory) {
    router.push('/map')
  }
}

function stayHere() {
  grantRewards()
  showResult.value = false
  battleLog.value = null
}

function toggleGarrison() {
  if (isGarrisoned.value) {
    // 撤回驻扎：直接撤回
    game.combat.ungarrison(strongholdId.value)
  } else {
    // 驻扎：弹出收益确认提示
    showGarrisonConfirm.value = true
  }
}

function confirmGarrison() {
  game.combat.garrison(strongholdId.value, formation.value.id)
  showGarrisonConfirm.value = false
}

function cancelGarrison() {
  showGarrisonConfirm.value = false
}
</script>

<template>
  <div v-if="stronghold" class="battle-view">
    <Icons />
    <button class="back-btn" @click="router.push('/map')">← 返回星图</button>

    <!-- 据点信息 -->
    <div class="stronghold-info" :style="{ '--c': STRONGHOLD_TYPES[stronghold.type].color }">
      <div class="s-icon">
        <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
          <use :href="'#' + stronghold.icon" />
        </svg>
      </div>
      <div class="s-meta">
        <h2 class="s-name font-display">{{ stronghold.name }}</h2>
        <p class="s-type">
          {{ STRONGHOLD_TYPES[stronghold.type].name }} · Tier {{ stronghold.tier }}
        </p>
        <p class="s-desc">{{ stronghold.desc }}</p>
      </div>
    </div>

    <!-- 无尽远征：深度选择（仅 /battle/endless） -->
    <div v-if="isEndless" class="endless-depth" data-testid="endless-depth-panel">
      <h3 class="section-title">远征深度</h3>
      <div class="depth-controls">
        <button
          class="depth-btn"
          :disabled="endlessDepth <= 1"
          data-testid="endless-depth-minus"
          aria-label="降低深度"
          @click="stepEndless(-1)"
        >
          −
        </button>
        <div class="depth-value font-mono" data-testid="endless-depth-value">
          第 {{ endlessDepth }} 层
          <span v-if="endlessDepth === endlessMaxDepth" class="depth-frontier">前沿</span>
        </div>
        <button
          class="depth-btn"
          :disabled="endlessDepth >= endlessMaxDepth"
          data-testid="endless-depth-plus"
          aria-label="提升深度"
          @click="stepEndless(1)"
        >
          ＋
        </button>
      </div>
      <p class="depth-hint">攻克「前沿」深度即可推进历史纪录；已通过层数可反复挑战</p>
    </div>

    <!-- 敌方信息 -->
    <div class="enemy-section">
      <h3 class="section-title">敌方部署</h3>
      <div class="enemy-list">
        <div v-for="(e, i) in stronghold.enemies" :key="i" class="enemy-card">
          <div class="e-name">{{ e.name }}</div>
          <div class="e-stats">
            <span class="stat">攻 {{ e.attack }}</span>
            <span class="stat">防 {{ e.defense }}</span>
            <span class="stat">HP {{ e.hp }}</span>
            <span class="stat count">×{{ e.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编队选择 -->
    <div class="formation-select">
      <h3 class="section-title">选择编队</h3>
      <div class="formation-tabs">
        <button
          v-for="(f, idx) in game.military.formations"
          :key="f.id"
          class="f-tab"
          :class="{ active: selectedFormation === idx }"
          @click="selectedFormation = idx"
        >
          {{ f.name }} · {{ game.military.formationPower(f, game.atkMult, game.defMult).atk }}
        </button>
      </div>
      <div class="formation-detail">
        <div v-for="r in formationRows" :key="r.unitId" class="fu-row">
          <span>{{ r.name }}</span>
          <span class="font-mono">×{{ r.count }}</span>
        </div>
        <div v-if="isFormationEmpty" class="empty-msg">编队为空，请先在部队页面分配兵力</div>
      </div>
    </div>

    <!-- 操作 -->
    <div class="actions">
      <button
        class="btn-accent"
        style="flex: 2; --accent: var(--color-alert)"
        :disabled="isFormationEmpty"
        @click="startBattle"
      >
        <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
          <use href="#i-ui-sword" />
        </svg>
        出征
      </button>
      <button
        v-if="!isEndless"
        class="btn-secondary"
        :class="{ 'garrison-active': isGarrisoned }"
        style="flex: 1"
        :disabled="isFormationEmpty"
        @click="toggleGarrison"
      >
        {{ isGarrisoned ? '撤回驻扎' : '挂机驻扎' }}
      </button>
    </div>

    <!-- 战斗日志 -->
    <div v-if="battleLog && !showResult" class="battle-log">
      <h3 class="section-title">战斗日志</h3>
      <div class="log-list">
        <div v-for="entry in battleLog" :key="entry.round" class="log-entry" :class="entry.side">
          <span class="log-round">R{{ entry.round }}</span>
          <span class="log-msg">{{ entry.msg }}</span>
        </div>
      </div>
    </div>

    <!-- 结果弹窗 -->
    <ModalOverlay
      v-model="showResult"
      :modal-class="{ victory: battleResult?.victory, defeat: !battleResult?.victory }"
      :aria-label="battleResult?.victory ? '战斗胜利' : '战斗失败'"
      @overlay-click="battleResult?.victory ? stayHere() : confirmResult()"
    >
      <h2 class="result-title font-display">{{ battleResult?.victory ? '胜 利' : '失 败' }}</h2>
      <p class="result-sub">{{ battleResult?.victory ? '据点已被攻克！' : '部队被击退…' }}</p>

      <div v-if="battleResult?.victory" class="result-rewards">
        <h4>战利品</h4>
        <div v-for="r in rewardRows" :key="r.key" class="reward-row">
          <span>{{ r.name }}</span>
          <span class="font-mono" style="color: var(--color-quantum)">+{{ r.amount }}</span>
        </div>
        <div v-if="battleResult.relic" class="relic-drop">
          <span
            class="rarity-tag"
            :style="{
              color: `var(--color-${battleResult.relic.rarity === 'legendary' ? 'amber' : battleResult.relic.rarity === 'epic' ? 'plasma' : battleResult.relic.rarity === 'rare' ? 'core' : 't-secondary'})`,
            }"
          >
            🎁 获得遗物：{{ battleResult.relic.name }}（{{ battleResult.relic.rarity }}）
          </span>
        </div>
      </div>

      <div v-if="battleResult?.losses" class="result-losses">
        <h4>损失</h4>
        <div v-for="l in lossRows" :key="l.key" class="loss-row">
          <span>{{ l.name }}</span>
          <span class="font-mono" style="color: var(--color-alert)">-{{ l.count }}</span>
        </div>
        <div v-if="hasNoLoss" class="no-loss">无损失</div>
      </div>

      <!-- 战报日志（整合进弹窗，胜败均可见） -->
      <div v-if="battleLog && battleLog.length" class="result-log">
        <h4>战报</h4>
        <div class="modal-log-list">
          <div v-for="entry in battleLog" :key="entry.round" class="log-entry" :class="entry.side">
            <span class="log-round">R{{ entry.round }}</span>
            <span class="log-msg">{{ entry.msg }}</span>
          </div>
        </div>
      </div>

      <div class="btn-group">
        <button v-if="battleResult?.victory" class="btn-primary" style="flex: 2" @click="stayHere">
          留在此据点
        </button>
        <button class="btn-secondary" style="flex: 1" @click="confirmResult">
          {{ battleResult?.victory ? '返回星图' : '确认' }}
        </button>
      </div>
    </ModalOverlay>

    <!-- 驻扎确认弹窗 -->
    <ModalOverlay
      v-model="showGarrisonConfirm"
      modal-class="garrison-confirm-modal"
      aria-label="挂机驻扎确认"
      @overlay-click="cancelGarrison"
    >
      <h2 class="result-title font-display">挂机驻扎</h2>
      <p class="result-sub">在「{{ stronghold.name }}」驻扎编队，持续获得以下收益</p>
      <div class="garrison-rewards">
        <h4>预期收益</h4>
        <div v-for="r in garrisonPreview" :key="r.id" class="reward-row">
          <span class="g-reward-name" :style="{ color: r.color }">{{ r.name }}</span>
          <span class="g-reward-rates font-mono">
            <span class="rate-sec">+{{ r.perSec }}/s</span>
            <span class="rate-hour">（{{ r.perHour }}/h）</span>
          </span>
        </div>
        <p class="garrison-hint">收益将自动加入资源产出，离线时也会结算</p>
      </div>
      <div class="btn-group">
        <button class="btn-secondary" style="flex: 1" @click="cancelGarrison">取消</button>
        <button
          class="btn-accent"
          style="flex: 2; --accent: var(--color-quantum)"
          @click="confirmGarrison"
        >
          确认驻扎
        </button>
      </div>
    </ModalOverlay>
  </div>
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
.s-type {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
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
  border-radius: 3px;
}
.stat.count {
  color: var(--color-alert);
}

.formation-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.f-tab {
  flex: 1;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.f-tab.active {
  background: var(--color-alert);
  color: var(--color-on-core);
  border-color: var(--color-alert);
}
.formation-detail {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.fu-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  padding: var(--space-1) 0;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

/* —— 无尽远征深度选择（v0.60）—— */
.endless-depth {
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-plasma) 45%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.depth-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.depth-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-line);
  background: var(--color-surface-raised, var(--color-surface));
  font-size: var(--text-lg);
  color: var(--color-t-primary);
  flex-shrink: 0;
}
.depth-btn:disabled {
  opacity: 0.35;
}
.depth-value {
  flex: 1;
  text-align: center;
  font-size: var(--text-md);
  color: var(--color-plasma);
}
.depth-frontier {
  display: inline-block;
  margin-left: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-on-core);
  background: var(--color-plasma);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-2);
}
.depth-hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
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
.log-entry {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--text-xs);
  border-bottom: 1px solid var(--color-border-line);
}
.log-entry.player {
  color: var(--color-core);
}
.log-entry.enemy {
  color: var(--color-alert);
}
.log-entry.system {
  color: var(--color-t-secondary);
}
.log-round {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  width: 32px;
  flex-shrink: 0;
}

.modal.victory {
  border-color: var(--color-quantum);
  box-shadow: 0 0 40px rgba(46, 230, 160, 0.2);
}
.modal.defeat {
  border-color: var(--color-alert);
  box-shadow: 0 0 40px rgba(244, 63, 94, 0.2);
}
.result-title {
  font-size: var(--text-xl);
  font-weight: 900;
  text-align: center;
  margin-bottom: var(--space-1);
}
.modal.victory .result-title {
  color: var(--color-quantum);
}
.modal.defeat .result-title {
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
.garrison-confirm-modal {
  border-color: var(--color-quantum);
  box-shadow: 0 0 40px rgba(46, 230, 160, 0.15);
}
.garrison-rewards {
  margin-bottom: var(--space-4);
}
.garrison-rewards h4 {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.g-reward-name {
  font-size: var(--text-sm);
  font-weight: 500;
}
.g-reward-rates {
  font-size: var(--text-sm);
}
.rate-sec {
  color: var(--color-quantum);
  font-weight: 700;
}
.rate-hour {
  color: var(--color-t-tertiary);
  font-size: var(--text-xs);
}
.garrison-hint {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-top: var(--space-2);
  text-align: center;
}
</style>
