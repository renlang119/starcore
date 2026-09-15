<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt, fmtTime } from '@/lib/format'
import { EXPLORE_NODES, LAYER_INFO, type StarLayer } from '@/data/explore'
import { STRONGHOLD_TYPES } from '@/data/pve'
import CostTag from '@/components/ui/CostTag.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useToast } from '@/composables/useToast'
import Toast from '@/components/ui/Toast.vue'
import { useRouter } from 'vue-router'

const game = useGameStore()
const router = useRouter()

const exploreMult = computed(() => game.exploreMult)
const completedNodes = computed(() => game.exploration.completedNodes)

// 响应式当前时间，驱动进度条自动刷新
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

// 是否有节点正在探索
const hasExploring = computed(() => EXPLORE_NODES.some((n) => game.exploration.isExploring(n.id)))

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding('map', ['map-explore'])

function startTimer() {
  if (timer) return
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// 有探索中节点时启动定时器，无探索时停止，避免空转
watch(
  hasExploring,
  (val) => {
    if (val) startTimer()
    else stopTimer()
  },
  { immediate: true }
)

onUnmounted(() => {
  stopTimer()
})

// 点击反馈 toast
const toast = useToast()
const showToast = toast.show

// 按层级分组（清单由 LAYER_INFO 派生，v0.97）
const layers = Object.keys(LAYER_INFO) as StarLayer[]

// 空状态：全部探索节点均已完成
const allNodesCompleted = computed(
  () => EXPLORE_NODES.length > 0 && EXPLORE_NODES.every((n) => game.exploration.isCompleted(n.id))
)
const nodesByLayer = computed(() => {
  const map = Object.fromEntries(layers.map((l) => [l, [] as typeof EXPLORE_NODES])) as Record<
    StarLayer,
    typeof EXPLORE_NODES
  >
  for (const n of EXPLORE_NODES) map[n.layer].push(n)
  return map
})

function tryExplore(nodeId: string) {
  const ok = game.exploration.startExplore(
    nodeId,
    exploreMult.value,
    (c) => game.resources.canAfford(c),
    (c) => game.resources.spendCost(c)
  )
  if (ok) {
    now.value = Date.now()
    showToast('探索已开始')
  }
}

function getProgress(nodeId: string) {
  // 读取 now.value 使计算依赖响应式时间，驱动进度条自动刷新
  void now.value
  return game.exploration.getProgress(nodeId)
}

function getNodeRewards(node: (typeof EXPLORE_NODES)[0]) {
  return Object.entries(node.rewards).map(([k, v]) => ({
    name: game.resources.allMeta[k as keyof typeof game.resources.allMeta]?.name ?? k,
    color: game.resources.allMeta[k as keyof typeof game.resources.allMeta]?.color ?? '#fff',
    amount: fmt(v as number),
  }))
}

// 已解锁的据点
const availableStrongholds = computed(() => {
  return game.combat.availableStrongholds(completedNodes.value)
})

// —— 无尽远征（v0.60）——
const endlessUnlockedNow = computed(() => game.combat.isEndlessUnlocked())
const endlessBest = computed(() => game.combat.expeditionBest)
/** 前沿深度 = 历史最深 + 1（攻克即推进） */
const endlessFrontier = computed(() => endlessBest.value + 1)
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
            v-for="node in nodesByLayer[layer]"
            :key="node.id"
            class="node-card"
            :class="{
              completed: game.exploration.isCompleted(node.id),
              exploring: game.exploration.isExploring(node.id),
              locked: node.requires && !node.requires.every((r) => game.exploration.isCompleted(r)),
            }"
          >
            <div class="n-head">
              <div class="n-dot" :style="{ background: LAYER_INFO[layer].color }"></div>
              <div class="n-name">{{ node.name }}</div>
              <span v-if="game.exploration.isCompleted(node.id)" class="n-done">
                <svg style="width: var(--icon-sm); height: var(--icon-sm)" aria-hidden="true">
                  <use href="#i-ui-check" />
                </svg>
              </span>
            </div>
            <p class="n-desc">{{ node.desc }}</p>

            <!-- 探索进度 -->
            <div v-if="game.exploration.isExploring(node.id)" class="n-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: getProgress(node.id) * 100 + '%',
                    background: LAYER_INFO[layer].color,
                  }"
                ></div>
              </div>
              <span class="progress-text font-mono"
                >{{ Math.floor(getProgress(node.id) * 100) }}%</span
              >
            </div>

            <!-- 成本 -->
            <div
              v-else-if="
                !game.exploration.isCompleted(node.id) &&
                (!node.requires || node.requires.every((r) => game.exploration.isCompleted(r)))
              "
              class="n-info"
            >
              <div class="n-cost">
                <CostTag :cost="node.cost" />
                <span class="time-tag font-mono">{{
                  fmtTime(node.time / exploreMult.toNumber())
                }}</span>
              </div>
              <button
                class="btn-accent sm"
                style="--accent: var(--color-quantum)"
                :disabled="!game.resources.canAfford(node.cost)"
                @click="tryExplore(node.id)"
              >
                探索
              </button>
            </div>

            <!-- 锁定 -->
            <div
              v-else-if="
                node.requires && !node.requires.every((r) => game.exploration.isCompleted(r))
              "
              class="n-locked"
            >
              需先完成：{{
                node.requires.map((r) => EXPLORE_NODES.find((x) => x.id === r)?.name).join(', ')
              }}
            </div>

            <!-- 已完成奖励预览 -->
            <div v-if="game.exploration.isCompleted(node.id)" class="n-rewards">
              <span class="rewards-label">已获得：</span>
              <span
                v-for="r in getNodeRewards(node)"
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
            <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
              <use :href="'#' + s.icon" />
            </svg>
          </div>
          <div class="s-info">
            <div class="s-name">{{ s.name }}</div>
            <div class="s-type">{{ STRONGHOLD_TYPES[s.type].name }} · Tier {{ s.tier }}</div>
          </div>
          <svg
            class="s-arrow"
            style="width: var(--icon-md); height: var(--icon-md)"
            aria-hidden="true"
          >
            <use href="#i-ui-arrow-right" />
          </svg>
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
          <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
            <use :href="'#' + STRONGHOLD_TYPES.silencer.icon" />
          </svg>
        </div>
        <div class="s-info">
          <div class="s-name">
            {{ endlessUnlockedNow ? `深渊·第 ${endlessFrontier} 层` : '？？？' }}
          </div>
          <div class="s-type font-mono">
            <template v-if="endlessUnlockedNow">历史最深 第 {{ endlessBest }} 层</template>
            <template v-else>攻克「沉默者旗舰」后开放</template>
          </div>
        </div>
        <svg
          v-if="endlessUnlockedNow"
          class="s-arrow"
          style="width: var(--icon-md); height: var(--icon-md)"
          aria-hidden="true"
        >
          <use href="#i-ui-arrow-right" />
        </svg>
      </button>
    </div>

    <!-- 点击反馈 toast -->
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
  height: 6px;
  background: var(--color-elevated);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
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
.s-type {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
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
