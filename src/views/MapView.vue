<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt, fmtTime } from '@/lib/format'
import { EXPLORE_NODES, LAYER_INFO, type StarLayer } from '@/data/explore'
import { STRONGHOLD_TYPES } from '@/data/pve'
import Icons from '@/components/ui/Icons.vue'
import CostTag from '@/components/ui/CostTag.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useOnboarding } from '@/composables/useOnboarding'
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
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 2000)
}
onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
})

// 按层级分组
const layers: StarLayer[] = ['orbit', 'inner', 'outer', 'deep']

// 空状态：全部探索节点均已完成
const allNodesCompleted = computed(
  () => EXPLORE_NODES.length > 0 && EXPLORE_NODES.every((n) => game.exploration.isCompleted(n.id))
)
const nodesByLayer = computed(() => {
  const map: Record<StarLayer, typeof EXPLORE_NODES> = { orbit: [], inner: [], outer: [], deep: [] }
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
  return game.exploration.getProgress(nodeId, exploreMult.value)
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
</script>

<template>
  <div class="map-view">
    <Icons />
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

    <!-- 空状态：已知星域全部探索完毕 -->
    <EmptyState
      v-if="allNodesCompleted"
      icon="i-nav-explore"
      text="已知星域已全部探索完毕"
      hint="提升科技等级可解锁更远星域"
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
      <h3 class="section-title">已解锁据点</h3>
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

    <!-- 点击反馈 toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>
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
.node-card.completed {
  border-color: var(--color-quantum);
  opacity: 0.8;
}
.node-card.locked {
  /* P2-7: 不降低 opacity，通过 --color-locked 区分 */
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
.time-tag {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
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

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: var(--space-2);
  padding-left: var(--space-2);
  border-left: 2px solid var(--color-alert);
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

.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  color: var(--color-core);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  pointer-events: none;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* P3-3 onboarding */
.onboard-map {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
