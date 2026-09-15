<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { BUILDINGS, SECTORS, type SectorId } from '@/data/buildings'
import { getTech } from '@/data/tech'
import CostTag from '@/components/ui/CostTag.vue'
import UpgradeCountdown from '@/components/build/UpgradeCountdown.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Toast from '@/components/ui/Toast.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useToast } from '@/composables/useToast'

const game = useGameStore()
// 全局轻提示（v0.77：建造开始反馈）
const toast = useToast()
const showToast = toast.show
const activeSector = ref<SectorId>('energy')

const sectors = Object.values(SECTORS)
const buildingsInSector = computed(() => BUILDINGS.filter((b) => b.sector === activeSector.value))
const completedTechs = computed(() => game.research.completed)

// 空状态：当前扇区全部建筑已满级（无可操作项）
const allMaxed = computed(
  () =>
    buildingsInSector.value.length > 0 &&
    buildingsInSector.value.every((b) => game.buildings.isMaxed(b.id))
)

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding('build', ['build-upgrade'])

// 3.12：使用原子操作替代 canAfford + spendCost + upgrade 三步
// v0.86 批量升级：段位切换 ×1/×10/×100，买满语义（能买几级买几级）
const bulkSteps = ref(1)

// v0.94 批量预览：×N>1 时每张卡展示实际可买级数与预计总花费（与实扣一致）
const bulkPreviews = computed(() => {
  const map: Record<string, { count: number; cost: Record<string, number> }> = {}
  if (bulkSteps.value > 1) {
    for (const b of buildingsInSector.value) {
      map[b.id] = game.previewUpgradeBuildingSteps(b.id, bulkSteps.value)
    }
  }
  return map
})

function tryUpgrade(id: string) {
  const done = game.tryUpgradeBuildingSteps(id, bulkSteps.value)
  if (!done) return
  // 资源消耗操作受理反馈（v0.77 反馈口径；批量时带实际完成级数）
  const name = BUILDINGS.find((b) => b.id === id)?.name ?? id
  showToast(done > 1 ? `开始建造：${name} ×${done}` : `开始建造：${name}`)
}
</script>

<template>
  <div class="build-view">
    <h2 class="page-title font-display">建造</h2>
    <!-- v0.86 批量升级段位切换（页头级，全部建筑卡共用） -->
    <div class="bulk-toggle" role="group" aria-label="单次升级级数">
      <button
        v-for="s in [1, 10, 100]"
        :key="s"
        class="seg-btn"
        :class="{ active: bulkSteps === s }"
        :aria-pressed="bulkSteps === s"
        @click="bulkSteps = s"
      >
        ×{{ s }}
      </button>
    </div>
    <p v-if="game.autoBuild" class="auto-badge" title="建造协议已激活：自动升级买得起的已解锁建筑">
      ⚙ 建造协议进行中
    </p>

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

    <!-- 空状态：当前扇区全部建筑满级 -->
    <EmptyState
      v-if="allMaxed"
      icon="i-nav-build"
      text="暂无可建造的建筑"
      hint="研究科技可解锁更多建筑类型"
      action="前往科技"
      to="/tech"
    />

    <!-- 建筑列表 -->
    <ul v-else class="building-list" aria-label="建筑列表">
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
        <div v-else-if="game.buildings.isMaxed(b.id)" class="b-maxed">
          <span>已满级</span>
        </div>
        <template v-else>
          <div class="b-cost">
            <template v-if="bulkSteps > 1">
              <span class="bulk-preview">可买 {{ bulkPreviews[b.id].count }} 级</span>
              <template v-if="bulkPreviews[b.id].count > 0">
                <span class="bulk-preview">· 共</span>
                <CostTag :cost="bulkPreviews[b.id].cost" />
              </template>
            </template>
            <CostTag v-else :cost="game.buildings.getCost(b.id)" />
          </div>
          <UpgradeCountdown :building-id="b.id" />
          <button
            class="btn-primary block"
            :disabled="!game.resources.canAfford(game.buildings.getCost(b.id))"
            @click="tryUpgrade(b.id)"
          >
            {{ bulkSteps > 1 ? `升级 ×${bulkSteps}` : '升级' }}
          </button>
        </template>
      </li>
    </ul>

    <!-- 建造开始轻提示（v0.77） -->
    <Toast :toast="toast" />
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

/* v0.86 批量升级段位切换器（页头级） */
.bulk-toggle {
  display: inline-flex;
  gap: 0;
  margin-bottom: var(--space-3);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  width: fit-content;
}
.seg-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-family: var(--font-mono, monospace);
  color: var(--color-t-secondary);
  background: transparent;
  transition: all 0.15s var(--ease-out);
}
.seg-btn + .seg-btn {
  border-left: 1px solid var(--color-border-line);
}
.seg-btn:hover {
  color: var(--color-t-primary);
  background: var(--color-hover);
}
.seg-btn.active {
  color: var(--color-core);
  background: color-mix(in srgb, var(--color-core) 10%, transparent);
}

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
.build-card:not(.locked):active {
  transform: translateY(0) scale(0.98); /* P2-4：卡片按压回弹 */
  transition: transform 0.1s var(--ease-out);
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
.build-card.locked .b-name {
  color: var(--color-locked); /* P2-7：锁定卡名称迁移 */
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
  background: color-mix(in srgb, var(--color-quantum) 8%, transparent);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.b-cost {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
/* v0.94 批量预览（×N>1 时的可买级数与总花费前缀） */
.bulk-preview {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--color-t-secondary);
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
