<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmtTime } from '@/lib/format'
import { resourceRows } from '@/lib/resource-rows'
import { EXPLORE_NODES, LAYER_INFO, type StarLayer } from '@/data/explore'
import { STRONGHOLD_TYPES } from '@/data/pve'
import CostTag from '@/components/ui/CostTag.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useToast } from '@/composables/useToast'
import Toast from '@/components/ui/Toast.vue'
import { useRouter } from 'vue-router'

const game = useGameStore()
const router = useRouter()

// P3-3 onboarding
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
    toast.show('探索已开始')
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
  title: '无尽远征',
  desc: '来自星团深处的未知威胁，越深入越危险，收获也越丰',
}
</script>

<template>
  <div class="map-view">
    <h2 class="page-title font-display">探索星图</h2>
    <p class="page-sub">探索未知星域，解锁据点与资源</p>
    <p v-if="game.autoExplore" class="auto-badge" title="探索协议已激活：自动开始可探索的星域节点">
      ⚙ 探索协议进行中
    </p>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'map-explore'"
      class="onboard-map"
      title="探索星图"
      text="选择星域发起探索，完成后获得资源与据点奖励。"
      @dismiss="dismiss"
      @skip="skipAll"
    />

    <!-- 空状态：全部节点完成（终层上线后 = 全宇宙探索完毕） -->
    <EmptyState
      v-if="allNodesCompleted"
      icon="i-nav-explore"
      text="全宇宙已探索完毕"
      hint="先驱者的航路与信号就此走完，星核文明接过了守门者的位置"
      action="前往科技"
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
          <div
            v-for="row in nodesByLayer[layer]"
            :key="row.node.id"
            class="node-card"
            :class="{ completed: row.completed, exploring: row.exploring, locked: row.locked }"
          >
            <div class="n-head">
              <div class="n-dot" :style="{ background: LAYER_INFO[layer].color }"></div>
              <div class="n-name">{{ row.node.name }}</div>
              <span v-if="row.completed" class="n-done">
                <Icon name="i-ui-check" size="sm" />
              </span>
            </div>
            <p class="n-desc">{{ row.node.desc }}</p>

            <!-- 探索进度 -->
            <div v-if="row.exploring" class="n-progress">
              <ProgressBar
                class="progress-bar"
                fill-class="progress-fill"
                :pct="row.progressPct"
                :fill="LAYER_INFO[layer].color"
              />
              <span class="progress-text font-mono">{{ Math.floor(row.progressPct) }}%</span>
            </div>

            <!-- 成本 -->
            <div v-else-if="!row.completed && !row.locked" class="n-info">
              <div class="n-cost">
                <CostTag :cost="row.node.cost" />
                <span class="time-tag font-mono">{{
                  fmtTime(row.node.time / game.exploreMult.toNumber())
                }}</span>
              </div>
              <button
                class="btn-accent sm"
                style="--accent: var(--color-quantum)"
                :disabled="!game.resources.canAfford(row.node.cost)"
                @click="tryExplore(row.node.id)"
              >
                探索
              </button>
            </div>

            <!-- 锁定 -->
            <div v-else-if="row.locked" class="n-locked">
              需先完成：{{
                (row.node.requires ?? [])
                  .map((r) => EXPLORE_NODES.find((x) => x.id === r)?.name)
                  .join(', ')
              }}
            </div>

            <!-- 已完成奖励预览 -->
            <div v-if="row.completed" class="n-rewards">
              <span class="rewards-label">已获得：</span>
              <span
                v-for="r in row.rewards"
                :key="r.name"
                class="reward-tag"
                :style="{ color: r.color }"
                >{{ r.name }} +{{ r.amount }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 已解锁据点 -->
    <div v-if="availableStrongholds.length > 0" class="stronghold-section">
      <h3 class="section-title alert">已解锁据点</h3>
      <div class="stronghold-list">
        <button
          v-for="s in availableStrongholds"
          :key="s.id"
          class="stronghold-card"
          :style="{ '--c': STRONGHOLD_TYPES[s.type].color }"
          @click="router.push('/battle/' + s.id)"
        >
          <div class="s-icon">
            <Icon :name="s.icon" size="md" />
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
            {{ endlessUnlockedNow ? `深渊·第 ${endlessFrontier} 层` : '？？？' }}
          </div>
          <div class="s-type font-mono">
            <template v-if="endlessUnlockedNow"
              >历史最深 第 {{ game.combat.expeditionBest }} 层</template
            >
            <template v-else>攻克「沉默者旗舰」后开放</template>
          </div>
        </div>
        <Icon v-if="endlessUnlockedNow" class="s-arrow" name="i-ui-arrow-right" size="md" />
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
.node-card {
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
.node-card:not(.locked):not(.completed):hover {
  transform: translateY(-2px); /* P2-4 */
  border-color: var(--color-border-glow);
  box-shadow: var(--elevation-2); /* P2-6 */
}
.node-card:not(.locked):not(.completed):active {
  transform: translateY(0) scale(0.98); /* P2-4：卡片按压回弹 */
  transition: transform 0.1s var(--ease-out);
}
.node-card.completed {
  border-color: var(--color-quantum);
  opacity: 0.8;
}
.n-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}
.n-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}
.n-name {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: 600;
}
.node-card.locked .n-name,
.node-card.locked .n-desc {
  color: var(--color-locked); /* P2-7：锁定卡名称与描述迁移 */
}
.n-done {
  color: var(--color-quantum);
}
.n-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
}

.n-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.progress-bar {
  flex: 1;
  --pb-radius: var(--radius-xs);
}
.progress-text {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}

.n-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.n-cost {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}
.n-locked {
  font-size: var(--text-xs);
  color: var(--color-locked);
} /* P2-7 */
.n-rewards {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}
.rewards-label {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
}
.reward-tag {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
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

/* P3-3 onboarding */
.onboard-map {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
