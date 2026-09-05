<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { BUILDINGS, SECTORS, type SectorId } from '@/data/buildings'
import { getTech } from '@/data/tech'
import Icons from '@/components/ui/Icons.vue'
import CostTag from '@/components/ui/CostTag.vue'
import UpgradeCountdown from '@/components/ui/UpgradeCountdown.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import { useOnboarding } from '@/composables/useOnboarding'

const game = useGameStore()
const activeSector = ref<SectorId>('energy')

const sectors = Object.values(SECTORS)
const buildingsInSector = computed(() => BUILDINGS.filter((b) => b.sector === activeSector.value))
const completedTechs = computed(() => game.research.completed)

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding('build', ['build-upgrade'])

// 3.12：使用原子操作替代 canAfford + spendCost + upgrade 三步
function tryUpgrade(id: string) {
  game.tryUpgradeBuilding(id)
}

function isMaxed(id: string): boolean {
  const def = BUILDINGS.find((b) => b.id === id)
  if (!def?.maxLevel) return false
  return game.buildings.getLevel(id) >= def.maxLevel
}
</script>

<template>
  <div class="build-view">
    <Icons />
    <h2 class="page-title font-display">建造</h2>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'build-upgrade'"
      class="onboard-build"
      title="建造"
      text="选择扇区后点击建筑卡片即可升级，提升资源产能。"
      @dismiss="dismiss"
      @skip="skipAll"
    />

    <!-- 扇区选择 -->
    <div class="sector-tabs">
      <button
        v-for="s in sectors"
        :key="s.id"
        class="sector-tab"
        :class="{ active: activeSector === s.id }"
        :style="{ '--c': s.color }"
        @click="activeSector = s.id"
      >
        {{ s.name }}
      </button>
    </div>
    <p class="sector-desc">{{ SECTORS[activeSector].desc }}</p>

    <!-- 建筑列表 -->
    <ul class="building-list" aria-label="建筑列表">
      <li
        v-for="b in buildingsInSector"
        :key="b.id"
        class="build-card"
        :class="{ locked: !game.buildings.isUnlocked(b, completedTechs) }"
      >
        <div class="b-head">
          <div class="b-icon" :style="{ color: SECTORS[b.sector].color }">
            <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
              <use :href="'#' + b.icon" />
            </svg>
          </div>
          <span class="b-level font-mono"
            >Tier {{ b.tier }} · Lv.{{ game.buildings.getLevel(b.id) }}</span
          >
        </div>
        <div class="b-name">{{ b.name }}</div>
        <div class="b-desc">{{ b.desc }}</div>

        <!-- 产出 -->
        <div v-if="b.produces" class="b-prod">
          <span v-for="(v, k) in b.produces" :key="k" class="prod-tag">
            +{{ fmt(v as number) }}/s
            {{ game.resources.allMeta[k as keyof typeof game.resources.allMeta]?.name }}
          </span>
        </div>

        <!-- 成本与升级 -->
        <div v-if="!game.buildings.isUnlocked(b, completedTechs)" class="b-locked">
          <span class="lock-msg"
            >需要科技：{{ getTech(b.requires ?? '')?.name ?? b.requires }}</span
          >
        </div>
        <div v-else-if="isMaxed(b.id)" class="b-maxed">
          <span>已满级</span>
        </div>
        <template v-else>
          <div class="b-cost">
            <CostTag :cost="game.buildings.getCost(b.id)" />
          </div>
          <UpgradeCountdown :building-id="b.id" />
          <button
            class="btn-primary block"
            :disabled="!game.resources.canAfford(game.buildings.getCost(b.id))"
            @click="tryUpgrade(b.id)"
          >
            升级
          </button>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.build-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}

.sector-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.sector-tab {
  flex: 1 1 calc(33.3% - 4px);
  min-width: 0;
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-t-secondary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s var(--ease-out);
}
.sector-tab.active {
  background: color-mix(in srgb, var(--c) 12%, transparent);
  border-color: var(--c);
  color: var(--c);
  font-weight: 600;
}
@media (min-width: 768px) {
  .sector-tab {
    flex: 1 1 auto;
    font-size: var(--text-sm);
    padding: var(--space-3) var(--space-3);
  }
}
.sector-desc {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  padding: 0 var(--space-1);
}

.building-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}
.build-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  box-shadow: var(--elevation-1); /* P2-6 */
  transition:
    transform 0.2s var(--ease-out),
    border-color 0.2s,
    box-shadow 0.2s var(--ease-out);
}
.build-card:not(.locked):hover {
  transform: translateY(-2px); /* P2-4 */
  border-color: var(--color-border-glow);
  box-shadow: var(--elevation-2); /* P2-6 */
}
.build-card.locked {
  /* P2-7: 不降低 opacity，通过 --color-locked 区分 */
}
.b-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}
.b-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}
.b-level {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  padding: var(--space-1) var(--space-2);
  background: var(--color-elevated);
  border-radius: var(--radius-pill);
}
.b-name {
  font-size: var(--text-base);
  font-weight: 600;
  margin-bottom: var(--space-1);
}
.b-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.4;
  margin-bottom: var(--space-2);
}

.b-prod {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.prod-tag {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--color-quantum);
  background: rgba(46, 230, 160, 0.08);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.b-cost {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.b-locked,
.b-maxed {
  text-align: center;
  padding: var(--space-2);
}
.lock-msg {
  font-size: var(--text-xs);
  color: var(--color-locked);
} /* P2-7 */
.b-maxed span {
  font-size: var(--text-xs);
  color: var(--color-amber);
}

/* P3-3 onboarding */
.onboard-build {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
