<script setup lang="ts">
import { t } from '@/i18n'
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { TECHS, TECH_BRANCHES, adjustedTechCost, type TechBranch } from '@/data/tech'
import CostTag from '@/components/ui/CostTag.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import { useOnboarding } from '@/composables/useOnboarding'

const game = useGameStore()
const activeBranch = ref<TechBranch | 'all'>('all')

const branches = Object.values(TECH_BRANCHES)
const techsToShow = computed(() => {
  const list =
    activeBranch.value === 'all' ? TECHS : TECHS.filter((t) => t.branch === activeBranch.value)
  return [...list].sort((a, b) => a.tier - b.tier)
})

// 空状态：当前筛选分支下所有科技均已完成
const allCompleted = computed(
  () =>
    techsToShow.value.length > 0 && techsToShow.value.every((t) => game.research.isCompleted(t.id))
)

// 空态文案按筛选口径分离（v0.97）：全量视图写全量结论，分支视图写分支结论
const emptyText = computed(() =>
  activeBranch.value === 'all'
    ? t('tech.allDone')
    : t('tech.branchDone', { branch: TECH_BRANCHES[activeBranch.value].name })
)

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding(['tech-research'])

function techStatus(id: string): 'completed' | 'available' | 'locked' {
  if (game.research.isCompleted(id)) return 'completed'
  const def = TECHS.find((t) => t.id === id)!
  if (game.research.available(def)) return 'available'
  return 'locked'
}

function getAdjustedCost(def: (typeof TECHS)[0]) {
  return adjustedTechCost(def.cost, game.techCostMult.toNumber())
}

function tryResearch(id: string) {
  game.tryResearch(id)
}
</script>

<template>
  <div class="tech-view">
    <h2 class="page-title font-display">{{ t('tech.title') }}</h2>
    <p class="page-sub">{{ t('tech.subtitle') }}</p>
    <p v-if="game.autoResearch" class="auto-badge" :title="t('tech.protocolActive')">
      ⚙ {{ t('tech.protocolOngoing') }}
    </p>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'tech-research'"
      class="onboard-tech"
      :title="t('tech.title')"
      :text="t('tech.onboarding')"
      @dismiss="dismiss"
      @skip="skipAll"
    />

    <!-- 分支筛选 -->
    <div class="branch-tabs">
      <button
        class="branch-tab"
        :class="{ active: activeBranch === 'all' }"
        @click="activeBranch = 'all'"
      >
        {{ t('tech.all') }}
      </button>
      <button
        v-for="b in branches"
        :key="b.id"
        class="branch-tab"
        :class="{ active: activeBranch === b.id }"
        :style="{ '--c': b.color }"
        @click="activeBranch = b.id"
      >
        <Icon class="b-icon" :name="b.icon" />
        {{ b.name }}
      </button>
    </div>

    <!-- 空状态：当前筛选口径下科技均已完成 -->
    <EmptyState
      v-if="allCompleted"
      icon="i-nav-tech"
      :text="emptyText"
      :hint="t('tech.emptyHint')"
      :action="t('common.goExplore')"
      to="/map"
    />

    <!-- 科技列表 -->
    <ul v-else class="tech-list" :aria-label="t('tech.listAria')">
      <li v-for="tech in techsToShow" :key="tech.id" class="tech-card" :class="techStatus(tech.id)">
        <div class="t-head">
          <div class="t-icon" :style="{ color: TECH_BRANCHES[tech.branch].color }">
            <Icon :name="tech.icon" size="md" />
          </div>
          <div class="t-info">
            <div class="t-name">{{ tech.name }}</div>
            <div class="t-branch" :style="{ color: TECH_BRANCHES[tech.branch].color }">
              {{ TECH_BRANCHES[tech.branch].name }} · Tier {{ tech.tier }}
            </div>
          </div>
          <div>
            <span v-if="techStatus(tech.id) === 'completed'" class="status-done">
              <Icon name="i-ui-check" size="md" />
            </span>
          </div>
        </div>
        <p class="t-desc">{{ tech.desc }}</p>

        <!-- 效果 -->
        <div class="t-effects">
          <span v-for="(e, i) in tech.effects" :key="i" class="eff-tag">{{ e.label }}</span>
        </div>

        <!-- 成本 -->
        <div v-if="techStatus(tech.id) !== 'completed'" class="t-cost">
          <CostTag :cost="getAdjustedCost(tech)" />
        </div>

        <!-- 前置 -->
        <div v-if="tech.requires && techStatus(tech.id) === 'locked'" class="t-req">
          {{ t('tech.needs')
          }}{{ tech.requires.map((r) => TECHS.find((x) => x.id === r)?.name).join(', ') }}
        </div>

        <button
          v-if="techStatus(tech.id) === 'available'"
          class="btn-accent block"
          style="--accent: var(--color-plasma)"
          :disabled="!game.resources.canAfford(getAdjustedCost(tech))"
          @click="tryResearch(tech.id)"
        >
          {{ t('tech.research') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tech-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}

.branch-tabs {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: var(--space-1);
}
.branch-tabs::-webkit-scrollbar {
  display: none;
}
.branch-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-t-secondary);
}
.b-icon {
  width: var(--icon-sm);
  height: var(--icon-sm);
}
.branch-tab.active {
  background: color-mix(in srgb, var(--c, var(--color-core)) 12%, transparent);
  border-color: var(--c, var(--color-core));
  color: var(--c, var(--color-core));
}

.tech-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}
.tech-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  box-shadow: var(--elevation-1); /* P2-6 */
  transition:
    opacity 0.2s,
    transform 0.2s var(--ease-out),
    border-color 0.2s,
    box-shadow 0.2s var(--ease-out);
}
.tech-card:not(.locked):not(.completed):hover {
  transform: translateY(-2px); /* P2-4 */
  border-color: var(--color-border-glow);
  box-shadow: var(--elevation-2); /* P2-6 */
}
.tech-card:not(.locked):not(.completed):active {
  transform: translateY(0) scale(0.98); /* P2-4：卡片按压回弹 */
  transition: transform 0.1s var(--ease-out);
}
.tech-card.completed {
  opacity: 0.6;
  border-color: var(--color-quantum);
}

.t-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.t-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--color-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.t-info {
  flex: 1;
}
.t-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.t-branch {
  font-size: var(--text-xs);
}
.status-done {
  color: var(--color-quantum);
}

.t-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
}

.t-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}
.eff-tag {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-core) 8%, transparent);
  color: var(--color-core);
}

.t-cost {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.t-req {
  font-size: var(--text-xs);
  color: var(--color-locked);
  margin-bottom: var(--space-2);
} /* P2-7 */

/* P3-3 onboarding */
.onboard-tech {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
