<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { resourceRows } from '@/lib/resource-rows'
import { getStronghold, STRONGHOLD_TYPES } from '@/data/pve'
import type { StrongholdDef } from '@/data/pve'
import { ENDLESS_STRONGHOLD_ID, MAX_ENDLESS_DEPTH } from '@/data/endless'
import { RARITY_INFO, relicRarityColor } from '@/data/relics'
import type { BattleLogEntry } from '@/stores/combat'
import { getUnit } from '@/data/units'
import type { UnitId } from '@/data/units'
import type { ResourceType } from '@/data/buildings'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import Icon from '@/components/ui/Icon.vue'
import LogList from '@/components/battle/LogList.vue'
import { useToast } from '@/composables/useToast'
import Toast from '@/components/ui/Toast.vue'

const route = useRoute()
const router = useRouter()
const game = useGameStore()

const strongholdId = computed(() => route.params.id as string)
/** 是否无尽远征（/battle/endless） */
const isEndless = computed(() => strongholdId.value === ENDLESS_STRONGHOLD_ID)

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

const stronghold = computed((): StrongholdDef | undefined =>
  isEndless.value ? endlessStrongholdDef.value : getStronghold(strongholdId.value)
)

const selectedFormation = ref(0)
const battleLog = ref<BattleLogEntry[] | null>(null)
/** 战斗结果类型由 store 推导（v0.77，替换 any） */
type BattleResult = ReturnType<typeof game.combat.resolveBattle>
const battleResult = ref<BattleResult | null>(null)
const showResult = ref(false)
const showGarrisonConfirm = ref(false)

// 编队兜底（v0.81）：注入档/异常档可能编队数不足，选中的下标越界时回退首支，
// 仍无编队（正常档经 storage 自愈后不会发生）时模板层显示空态，不再读 undefined 崩页
const formation = computed(
  () => game.military.formations[selectedFormation.value] ?? game.military.formations[0]
)

const isGarrisoned = computed(() => !!game.combat.garrisoned[strongholdId.value])

// —— v0.82 驻扎/出征校验：据点须解锁且已攻克（远征分支除外）——
const strongholdUnlocked = computed(() => {
  if (isEndless.value) return game.combat.isEndlessUnlocked()
  const def = getStronghold(strongholdId.value)
  if (!def) return false
  return game.exploration.prereqMet(def.requires)
})
/** 已攻克：正式据点须在通关集内（未攻克可出战但不可驻扎） */
const strongholdConquered = computed(
  () => isEndless.value || game.combat.completedStrongholds.has(strongholdId.value)
)
/** 出征禁用 = 编队空或据点未解锁 */
const battleDisabled = computed(() => isFormationEmpty.value || !strongholdUnlocked.value)
/** 驻扎禁用 = 编队空或据点未攻克 */
const garrisonDisabled = computed(() => isFormationEmpty.value || !strongholdConquered.value)

// 战损 toast（v0.82 战损结算：编队减员即时提示）
const toast = useToast()

// 驻扎收益预览（每秒 + 每小时）
const garrisonPreview = computed(() => {
  const idle = game.combat.garrisonIdleReward(strongholdId.value)
  return resourceRows(idle, game.resources.allMeta, { positiveOnly: true }).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    perSec: r.amount,
    perHour: fmt(Number(idle[r.id]) * 3600),
  }))
})

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

// 战斗结果展示数据
const rewardRows = computed(() => {
  if (!battleResult.value?.rewards) return []
  return resourceRows(battleResult.value.rewards, game.resources.allMeta, { positiveOnly: true })
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
  if (!stronghold.value || !formation.value) return
  const result = game.combat.resolveBattle(
    formation.value,
    stronghold.value,
    game.atkMult,
    game.defMult
  )
  battleLog.value = result.log
  battleResult.value = result
  showResult.value = true
  applyBattleLosses(result)
  // 无尽远征：攻克当前前沿 → 推进历史最深深度（随奖励即时发放，见 grantRewards）
  // 成就终身计数：据点攻克（胜利）次数（远征战果同样计入战斗里程碑）
  if (result.victory) {
    game.achievements.recordBattle()
    game.achievements.checkAndUnlock()
    game.daily.bump('battles')
    // 奖励即时发放（v0.94）：战斗结算即落袋，结果弹窗只做展示；
    // 修复弹窗打开期间离开页面导致资源、遗物与远征推进丢失的问题
    grantRewards(result)
  }
}

/**
 * 战损结算（v0.82 战损接线）：胜负都按 losses 从编队扣兵，战报「损失 N 支」由此为真。
 * 编队全灭清空该编队；若该编队驻扎中自动撤驻（收益随撤驻停止）并 toast 提示。
 */
function applyBattleLosses(result: ReturnType<typeof game.combat.resolveBattle>) {
  const f = formation.value
  if (!f) return
  game.military.applyLosses(f, result.losses as never)
  const totalLoss = Object.values(result.losses).reduce((a, b) => a + b, 0)
  if (totalLoss > 0) {
    const survivors = Object.values(f.units).reduce((a, b) => a + b, 0)
    if (survivors === 0) {
      toast.show(`${f.name} 全军覆没，已清空编队`)
      // 全灭的编队若驻扎中，自动撤驻
      for (const [sid, g] of Object.entries(game.combat.garrisoned)) {
        if (g.formationId === f.id) {
          game.combat.ungarrison(sid)
          toast.show(`${f.name} 已从驻扎撤回`)
          break
        }
      }
    } else if (totalLoss > 0) {
      toast.show(`${f.name} 损失 ${totalLoss} 支部队`)
    }
  }
}

/** 胜利奖励即时发放（v0.94）：战斗结算时调用一次，不依赖弹窗交互 */
function grantRewards(result: BattleResult) {
  for (const [k, v] of Object.entries(result.rewards)) {
    if (v) game.resources.gain(k as ResourceType, v as number)
  }
  if (result.relic) game.relics.obtain(result.relic)
  // 远征：奖励落袋的同时记录战果（攻克当前前沿才推进，重打不推进）
  if (isEndless.value) {
    game.combat.recordExpedition(endlessDepth.value, true)
  }
}

function confirmResult() {
  showResult.value = false
  if (battleResult.value?.victory) {
    router.push('/map')
  }
}

function stayHere() {
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
  if (!formation.value) {
    showGarrisonConfirm.value = false
    return
  }
  const ok = game.combat.garrison(strongholdId.value, formation.value.id)
  if (!ok) {
    // 守卫拒绝（未攻克/编队被他处占用等）：提示而非静默
    toast.show(isGarrisoned.value ? '该据点已有编队驻扎' : '当前无法驻扎：据点未攻克或编队不可用')
  }
  showGarrisonConfirm.value = false
}

function cancelGarrison() {
  showGarrisonConfirm.value = false
}
</script>

<template>
  <div v-if="stronghold" class="battle-view">
    <button class="back-btn" @click="router.push('/map')">← 返回星图</button>

    <!-- 据点信息 -->
    <div class="stronghold-info" :style="{ '--c': STRONGHOLD_TYPES[stronghold.type].color }">
      <div class="s-icon">
        <Icon :name="stronghold.icon" size="lg" />
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
    <div>
      <h3 class="section-title">敌方部署</h3>
      <div class="enemy-list">
        <div v-for="(e, i) in stronghold.enemies" :key="i" class="enemy-card">
          <div class="e-name">{{ e.name }}</div>
          <div class="e-stats">
            <span class="stat">攻 {{ fmt(e.attack) }}</span>
            <span class="stat">防 {{ fmt(e.defense) }}</span>
            <span class="stat">HP {{ fmt(e.hp) }}</span>
            <span class="stat count">×{{ e.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编队选择 -->
    <div>
      <h3 class="section-title">选择编队</h3>
      <div class="formation-tabs">
        <button
          v-for="(f, idx) in game.military.formations"
          :key="f.id"
          class="f-tab"
          :class="{ active: selectedFormation === idx }"
          @click="selectedFormation = idx"
        >
          {{ f.name }} · {{ fmt(game.military.formationPower(f, game.atkMult, game.defMult).atk) }}
        </button>
      </div>
      <div class="formation-detail">
        <div v-for="r in formationRows" :key="r.unitId" class="fu-row">
          <span>{{ r.name }}</span>
          <span class="font-mono">×{{ r.count }}</span>
        </div>
        <div v-if="isFormationEmpty" class="empty-msg">编队为空，请先在部队页面分配兵力</div>
        <div v-else-if="!strongholdUnlocked && !isEndless" class="empty-msg">
          据点尚未解锁，无法出征
        </div>
      </div>
    </div>

    <!-- 点击反馈 toast（战损/驻扎提示） -->
    <Toast :toast="toast" />

    <!-- 操作 -->
    <div class="actions">
      <button
        class="btn-accent"
        style="flex: 2; --accent: var(--color-alert)"
        :disabled="battleDisabled"
        data-testid="battle-start"
        @click="startBattle"
      >
        <Icon name="i-ui-sword" size="md" />
        出征
      </button>
      <button
        v-if="!isEndless"
        class="btn-secondary"
        :class="{ 'garrison-active': isGarrisoned }"
        style="flex: 1"
        :disabled="garrisonDisabled"
        data-testid="battle-garrison"
        @click="toggleGarrison"
      >
        {{ isGarrisoned ? '撤回驻扎' : '挂机驻扎' }}
      </button>
    </div>

    <!-- 战斗日志 -->
    <div v-if="battleLog && !showResult" class="battle-log">
      <h3 class="section-title">战斗日志</h3>
      <LogList class="log-list" :entries="battleLog" />
    </div>

    <!-- 结果弹窗 -->
    <ModalOverlay
      :model-value="showResult"
      :modal-class="{ victory: battleResult?.victory === true, defeat: !battleResult?.victory }"
      :aria-label="battleResult?.victory ? '战斗胜利' : '战斗失败'"
      @overlay-click="battleResult?.victory ? stayHere() : confirmResult()"
    >
      <h2 class="result-title font-display">{{ battleResult?.victory ? '胜 利' : '失 败' }}</h2>
      <p class="result-sub">{{ battleResult?.victory ? '据点已被攻克！' : '部队被击退…' }}</p>

      <div v-if="battleResult?.victory" class="result-rewards">
        <h4>战利品</h4>
        <div v-for="r in rewardRows" :key="r.id" class="reward-row">
          <span>{{ r.name }}</span>
          <span class="font-mono" style="color: var(--color-quantum)">+{{ r.amount }}</span>
        </div>
        <div v-if="battleResult.relic" class="relic-drop">
          <span class="rarity-tag" :style="{ color: relicRarityColor(battleResult.relic.rarity) }">
            🎁 获得遗物：{{ battleResult.relic.name }}（{{
              RARITY_INFO[battleResult.relic.rarity].name
            }}）
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
        <LogList class="modal-log-list" :entries="battleLog" />
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
    <ConfirmModal
      :model-value="showGarrisonConfirm"
      modal-class="garrison-confirm-modal"
      aria-label="挂机驻扎确认"
      confirm-text="确认驻扎"
      :confirm-flex="2"
      accent="var(--color-quantum)"
      @cancel="cancelGarrison"
      @confirm="confirmGarrison"
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
    </ConfirmModal>
  </div>
  <EmptyState
    v-else
    icon="i-nav-explore"
    text="据点不存在"
    hint="该据点可能已被移除，请返回星图重新选择"
    action="返回星图"
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
  background: var(--color-surface);
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
  font-size: var(--text-base);
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

/* 弹窗本体挂载在 ModalOverlay 内部（只带 ModalOverlay 的 data-v），
   本视图 scoped 规则须经 :deep() 穿透才能命中（v0.77 RelicView 同源坑补齐） */
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
:deep(.garrison-confirm-modal) {
  border-color: var(--color-quantum);
  box-shadow: 0 0 40px color-mix(in srgb, var(--color-quantum) 15%, transparent);
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
