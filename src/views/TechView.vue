<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { TECHS, TECH_BRANCHES, adjustedTechCost, type TechBranch } from '@/data/tech'
import CostTag from '@/components/ui/CostTag.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding('tech', ['tech-research'])

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
    <h2 class="page-title font-display">科技树</h2>
    <p class="page-sub">研究新技术解锁建筑、兵种和系统</p>
    <p v-if="game.autoResearch" class="auto-badge" title="研究协议已激活：自动研究买得起的可用科技">
      ⚙ 研究协议进行中
    </p>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'tech-research'"
      class="onboard-tech"
      title="科技树"
      text="研究科技可解锁新建筑、兵种和系统。消耗数据流进行研发。"
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
        全部
      </button>
      <button
        v-for="b in branches"
        :key="b.id"
        class="branch-tab"
        :class="{ active: activeBranch === b.id }"
        :style="{ '--c': b.color }"
        @click="activeBranch = b.id"
      >
        {{ b.name }}
      </button>
    </div>

    <!-- 空状态：全部科技已完成 -->
    <EmptyState
      v-if="allCompleted"
      icon="i-nav-tech"
      text="所有已知科技已研究完成"
      hint="探索新星域可能发现未知科技"
      action="前往探索"
      to="/map"
    />

    <!-- 科技列表 -->
    <ul v-else class="tech-list" aria-label="科技列表">
      <li v-for="t in techsToShow" :key="t.id" class="tech-card" :class="techStatus(t.id)">
        <div class="t-head">
          <div class="t-icon" :style="{ color: TECH_BRANCHES[t.branch].color }">
            <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
              <use :href="'#' + t.icon" />
            </svg>
          </div>
          <div class="t-info">
            <div class="t-name">{{ t.name }}</div>
            <div class="t-branch" :style="{ color: TECH_BRANCHES[t.branch].color }">
              {{ TECH_BRANCHES[t.branch].name }} · Tier {{ t.tier }}
            </div>
          </div>
          <div class="t-status">
            <span v-if="techStatus(t.id) === 'completed'" class="status-done">
              <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
                <use href="#i-ui-check" />
              </svg>
            </span>
          </div>
        </div>
        <p class="t-desc">{{ t.desc }}</p>

        <!-- 效果 -->
        <div class="t-effects">
          <span v-for="(e, i) in t.effects" :key="i" class="eff-tag">{{ e.label }}</span>
        </div>

        <!-- 成本 -->
        <div v-if="techStatus(t.id) !== 'completed'" class="t-cost">
          <CostTag :cost="getAdjustedCost(t)" />
        </div>

        <!-- 前置 -->
        <div v-if="t.requires && techStatus(t.id) === 'locked'" class="t-req">
          需要：{{ t.requires.map((r) => TECHS.find((x) => x.id === r)?.name).join(', ') }}
        </div>

        <button
          v-if="techStatus(t.id) === 'available'"
          class="btn-accent block"
          style="--accent: var(--color-plasma)"
          :disabled="!game.resources.canAfford(getAdjustedCost(t))"
          @click="tryResearch(t.id)"
        >
          研究
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.auto-badge {
  font-size: var(--text-xs);
  color: var(--color-quantum);
  margin-top: calc(-1 * var(--space-2));
  margin-bottom: var(--space-2);
  letter-spacing: 0.05em;
}

.tech-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-sub {
  margin-top: calc(-1 * var(--space-2));
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
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-t-secondary);
}
.branch-tab.active {
  background: color-mix(in srgb, var(--c, #00e5ff) 12%, transparent);
  border-color: var(--c, #00e5ff);
  color: var(--c, #00e5ff);
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
.tech-card.completed {
  opacity: 0.6;
  border-color: var(--color-quantum);
}
.tech-card.locked {
  /* P2-7: 不降低 opacity，通过 --color-locked 区分 */
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
  background: rgba(0, 229, 255, 0.08);
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
