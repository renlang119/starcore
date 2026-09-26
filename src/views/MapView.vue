<script setup lang="ts">
import { t } from '@/i18n'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { resourceRows } from '@/lib/resource-rows'
import { MILESTONE_STEP, endlessMilestoneReward } from '@/data/endless'
import { WEEKLY_BOSS_ID, weeklyBossTemplateId, weeklyBossStronghold } from '@/data/weekly-boss'
import { EXPLORE_NODES, LAYER_INFO, type StarLayer } from '@/data/explore'
import { STRONGHOLD_TYPES, STRONGHOLDS } from '@/data/pve'
import ExploreNodeCard from '@/components/map/ExploreNodeCard.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useToast } from '@/composables/useToast'
import Toast from '@/components/ui/Toast.vue'
import { useRouter } from 'vue-router'

const game = useGameStore()
const router = useRouter()

// onboarding
const { activeStep, dismiss, skipAll } = useOnboarding(['map-explore'])

// 点击反馈 toast
const toast = useToast()

// 按层级分组（清单由 LAYER_INFO 派生，v0.97）
const layers = Object.keys(LAYER_INFO) as StarLayer[]

// 空状态：全部探索节点均已完成
const allNodesCompleted = computed(
  () => EXPLORE_NODES.length > 0 && EXPLORE_NODES.every((n) => game.exploration.isCompleted(n.id))
)
/** 节点视图行：状态 / 进度 / 奖励一次性派生（读取 store 每秒 tick 时间戳驱动进度刷新） */
interface NodeRow {
  node: (typeof EXPLORE_NODES)[number]
  completed: boolean
  exploring: boolean
  locked: boolean
  progressPct: number
  rewards: ReturnType<typeof resourceRows>
}
const nodesByLayer = computed(() => {
  void game.lastTickTime
  const metaMap = game.resources.allMeta
  const map = Object.fromEntries(layers.map((l) => [l, [] as NodeRow[]])) as Record<
    StarLayer,
    NodeRow[]
  >
  for (const node of EXPLORE_NODES) {
    const exploring = game.exploration.isExploring(node.id)
    map[node.layer].push({
      node,
      completed: game.exploration.isCompleted(node.id),
      exploring,
      locked: !game.exploration.prereqMet(node.requires),
      progressPct: exploring ? game.exploration.getProgress(node.id) * 100 : 0,
      rewards: resourceRows(node.rewards, metaMap),
    })
  }
  return map
})

function tryExplore(nodeId: string) {
  const ok = game.exploration.startExplore(
    nodeId,
    game.exploreMult,
    (c) => game.resources.canAfford(c),
    (c) => game.resources.spendCost(c)
  )
  if (ok) {
    toast.show(t('map.exploreStarted'))
  }
}

// 已解锁的据点
const availableStrongholds = computed(() => {
  return game.combat.availableStrongholds(game.exploration.completedNodes)
})

// —— 无尽远征（v0.60）——
const endlessUnlockedNow = computed(() => game.combat.isEndlessUnlocked())
/** 前沿深度 = 历史最深 + 1（攻克即推进） */
const endlessFrontier = computed(() => game.combat.expeditionBest + 1)
const endlessSection = {
  title: t('map.endless'),
  desc: t('map.endlessDesc'),
}

// —— 远征里程碑（v1.20 可玩内容扩展方案 2）——
/** 最小可领档位（0 = 无）；达标时卡下方显示领取条（并置结构，卡本体仍走跳转） */
const milestoneReadyTier = computed(() => game.combat.nextMilestoneTier)
/** 领取条文案：档位对应深度 = 档位 × 步长 */
const milestoneDepth = computed(() =>
  milestoneReadyTier.value > 0 ? milestoneReadyTier.value * MILESTONE_STEP : 0
)
/** 奖励预览行：资源名 + 数值（fmt 缩写，按 resources 键序渲染） */
const milestonePreview = computed(() => {
  if (milestoneReadyTier.value === 0) return []
  const reward = endlessMilestoneReward(milestoneReadyTier.value)
  return resourceRows(reward, game.resources.allMeta, { positiveOnly: true })
})

/** 领取：走 game store 发放包装（资源入账），成功 toast 回执 */
function claimMilestone() {
  if (milestoneReadyTier.value === 0) return
  const tier = milestoneReadyTier.value
  const reward = game.claimMilestone(tier)
  if (reward) toast.show(t('map.milestoneClaimed', { depth: tier * MILESTONE_STEP }))
}

// —— 每周强敌（v1.24 可玩内容扩展方案 5）——
/** 解锁口径与远征一致（锚点据点 silencer_3） */
const weeklyBossUnlocked = computed(() => game.combat.isEndlessUnlocked())
/** 本周是否已击败（跨周自动失效由 daily store 承担） */
const weeklyBossDefeated = computed(() => game.daily.isWeeklyBossDefeated())
/** 本周 Boss 卡展示（模板名/类型色系随周种子走；未解锁不预览编成）。
 *  显示名走数据字段（STRONGHOLD_TYPES/STRONGHOLDS 的 name 已是取词后显示名），
 *  不做「id → 键」拼接取词（check-locales --strict 门禁口径，v1.23 实踩） */
const weeklyBossCard = computed(() => {
  if (!weeklyBossUnlocked.value) return null
  const wk = game.daily.currentWeek // 响应式当前周（跨周自动重算）
  const def = weeklyBossStronghold(game.combat.expeditionBest, wk)
  const tid = weeklyBossTemplateId(wk)
  const templateName = STRONGHOLDS.find((s) => s.id === tid)?.name ?? ''
  return {
    id: WEEKLY_BOSS_ID,
    name: def.name,
    type: def.type,
    typeName: STRONGHOLD_TYPES[def.type].name,
    templateName,
    rewards: resourceRows(def.rewards, game.resources.allMeta, { positiveOnly: true }),
  }
})
</script>

<template>
  <div class="map-view">
    <h2 class="page-title font-display">{{ t('map.title') }}</h2>
    <p class="page-sub">{{ t('map.subtitle') }}</p>
    <p v-if="game.autoExplore" class="auto-badge" :title="t('map.protocolActive')">
      ⚙ {{ t('map.protocolOngoing') }}
    </p>

    <!-- onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'map-explore'"
      class="onboard-map"
      :title="t('map.title')"
      :text="t('map.onboarding')"
      @dismiss="dismiss"
      @skip="skipAll"
    />

    <!-- 空状态：全部节点完成（终层上线后 = 全宇宙探索完毕） -->
    <EmptyState
      v-if="allNodesCompleted"
      icon="i-nav-explore"
      :text="t('map.allDoneTitle')"
      :hint="t('map.allDoneHint')"
      :action="t('common.goTech')"
      to="/tech"
    />

    <!-- 星图层 -->
    <template v-else>
      <div v-for="layer in layers" :key="layer" class="layer-section">
        <div class="layer-header" :style="{ color: LAYER_INFO[layer].color }">
          <span class="layer-name">{{ LAYER_INFO[layer].name }}</span>
          <span class="layer-dist">{{ LAYER_INFO[layer].distance }}</span>
        </div>

        <div class="node-list">
          <ExploreNodeCard
            v-for="row in nodesByLayer[layer]"
            :key="row.node.id"
            :node="row.node"
            :completed="row.completed"
            :exploring="row.exploring"
            :locked="row.locked"
            :progress-pct="row.progressPct"
            :rewards="row.rewards"
            :layer-color="LAYER_INFO[layer].color"
            @explore="tryExplore"
          />
        </div>
      </div>
    </template>

    <!-- 已解锁据点 -->
    <div v-if="availableStrongholds.length > 0" class="stronghold-section">
      <h3 class="section-title alert">{{ t('map.unlockedStrongholds') }}</h3>
      <div class="stronghold-list">
        <button
          v-for="s in availableStrongholds"
          :key="s.id"
          class="stronghold-card"
          :style="{ '--c': STRONGHOLD_TYPES[s.type].color }"
          @click="router.push('/battle/' + s.id)"
        >
          <div class="s-icon">
            <Icon :name="STRONGHOLD_TYPES[s.type].icon" size="md" />
          </div>
          <div class="s-info">
            <div class="s-name">{{ s.name }}</div>
            <div class="s-type">{{ STRONGHOLD_TYPES[s.type].name }} · Tier {{ s.tier }}</div>
          </div>
          <Icon class="s-arrow" name="i-ui-arrow-right" size="md" />
        </button>
      </div>
    </div>

    <!-- 无尽远征（v0.60）：独立区块，未解锁置灰可见 -->
    <div class="endless-section" data-testid="endless-section">
      <h3
        class="section-title alert endless-title"
        :style="{ color: STRONGHOLD_TYPES.silencer.color }"
      >
        {{ endlessSection.title }}
      </h3>
      <p class="endless-desc">{{ endlessSection.desc }}</p>
      <button
        class="endless-card"
        :class="{ unlocked: endlessUnlockedNow }"
        :style="{ '--c': STRONGHOLD_TYPES.silencer.color }"
        :disabled="!endlessUnlockedNow"
        :data-testid="endlessUnlockedNow ? 'endless-card-unlocked' : 'endless-card-locked'"
        @click="router.push('/battle/endless')"
      >
        <div class="s-icon">
          <Icon :name="STRONGHOLD_TYPES.silencer.icon" size="md" />
        </div>
        <div class="s-info">
          <div class="s-name">
            {{
              endlessUnlockedNow
                ? t('map.abyssDepth', { depth: endlessFrontier })
                : t('map.abyssLocked')
            }}
          </div>
          <div class="s-type font-mono">
            <template v-if="endlessUnlockedNow"
              >{{ t('map.deepest') }} {{ t('map.depthLead') }} {{ game.combat.expeditionBest }}
              {{ t('map.depthUnit') }}</template
            >
            <template v-else>{{ t('map.lockedHint') }}</template>
          </div>
        </div>
        <Icon v-if="endlessUnlockedNow" class="s-arrow" name="i-ui-arrow-right" size="md" />
      </button>

      <!-- 里程碑领取条（v1.20）：并置于卡下方；里程碑为终身数据，
           不挂本轮解锁态（转生后重克旗舰前仍可领取已达标档位） -->
      <div v-if="milestoneReadyTier > 0" class="milestone-bar" data-testid="milestone-ready">
        <div class="m-info">
          <span class="m-title">{{ t('map.milestoneReady') }}</span>
          <span class="m-tier font-mono">{{
            t('map.milestoneTier', { depth: milestoneDepth })
          }}</span>
          <span class="m-rewards font-mono">
            <template v-for="(row, i) in milestonePreview" :key="row.id">
              <span v-if="i > 0"> · </span>{{ row.name }} +{{ row.amount }}
            </template>
          </span>
        </div>
        <button class="m-claim btn-accent" data-testid="milestone-claim" @click="claimMilestone">
          {{ t('map.milestoneClaim') }}
        </button>
      </div>

      <!-- 周强敌卡（v1.24）：随远征区块并置；解锁口径同远征，未解锁置灰可见 -->
      <button
        class="endless-card weekly-boss-card"
        :class="{ unlocked: weeklyBossUnlocked, defeated: weeklyBossDefeated }"
        :style="{ '--c': weeklyBossCard ? STRONGHOLD_TYPES[weeklyBossCard.type].color : '' }"
        :disabled="!weeklyBossUnlocked"
        :data-testid="
          weeklyBossDefeated
            ? 'weekly-boss-done'
            : weeklyBossUnlocked
              ? 'weekly-boss-open'
              : 'weekly-boss-locked'
        "
        @click="router.push('/battle/weekly_boss')"
      >
        <div class="s-icon">
          <Icon
            :name="
              weeklyBossCard
                ? STRONGHOLD_TYPES[weeklyBossCard.type].icon
                : STRONGHOLD_TYPES.silencer.icon
            "
            size="md"
          />
        </div>
        <div class="s-info">
          <div class="s-name">{{ t('map.weeklyBossTitle') }}</div>
          <div class="s-type">
            <template v-if="weeklyBossDefeated">{{ t('map.weeklyBossDone') }}</template>
            <template v-else-if="weeklyBossCard">{{
              t('map.weeklyBossReady', { name: weeklyBossCard.templateName })
            }}</template>
            <template v-else>{{ t('map.weeklyBossLocked') }}</template>
          </div>
          <div v-if="weeklyBossCard && !weeklyBossDefeated" class="s-type font-mono wb-rewards">
            <template v-for="(row, i) in weeklyBossCard.rewards" :key="row.id">
              <span v-if="i > 0"> · </span>{{ row.name }} +{{ row.amount }}
            </template>
          </div>
        </div>
        <Icon v-if="weeklyBossUnlocked" class="s-arrow" name="i-ui-arrow-right" size="md" />
      </button>
    </div>

    <!-- 点击反馈 toast -->
    <Toast :toast="toast" />
  </div>
</template>

<style scoped>
.map-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: screenIn 0.4s var(--ease-out);
}

.layer-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.layer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 0 var(--space-1);
}
.layer-dist {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  opacity: 0.7;
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.stronghold-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.stronghold-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--c);
  border-radius: var(--radius-md);
}
.stronghold-card:active {
  transform: scale(0.98);
}
.s-icon {
  color: var(--c);
}
.s-info {
  flex: 1;
  text-align: left;
}
.s-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.s-arrow {
  color: var(--color-t-tertiary);
}

/* —— 无尽远征（v0.60）—— */
.endless-section {
  margin-top: var(--space-2);
}
.endless-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.endless-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  background: var(--color-surface);
  border: 1px dashed var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  opacity: 0.55;
}
.endless-card.unlocked {
  border: 1px solid var(--c);
  opacity: 1;
  box-shadow: 0 0 12px color-mix(in srgb, var(--c) 25%, transparent);
}
.endless-card.unlocked:active {
  transform: scale(0.98);
}
.endless-card .s-icon {
  color: var(--c);
}

/* —— 里程碑领取条（v1.20）：并置于远征卡下方 —— */
.milestone-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  margin-top: var(--space-2);
  background: color-mix(in srgb, var(--color-amber) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-amber) 45%, transparent);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

/* —— 周强敌卡（v1.24）：复用远征卡骨架，实线边框区分 —— */
.weekly-boss-card {
  margin-top: var(--space-2);
  border-style: solid;
}
.weekly-boss-card.defeated {
  opacity: 0.6;
}
.weekly-boss-card .wb-rewards {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.milestone-bar .m-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.milestone-bar .m-title {
  font-size: var(--text-xs);
  color: var(--color-amber);
}
.milestone-bar .m-tier {
  font-size: var(--text-sm);
  color: var(--color-t-primary);
}
.milestone-bar .m-rewards {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.milestone-bar .m-claim {
  flex-shrink: 0;
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
}

/* onboarding */
.onboard-map {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
