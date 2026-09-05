<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt, fmtRate, fmtTime } from '@/lib/format'
import { BUILDINGS } from '@/data/buildings'
import { TECHS } from '@/data/tech'
import { getNode } from '@/data/explore'
import { getUnit } from '@/data/units'
import { EXPLORE_NODES } from '@/data/explore'
import Icons from '@/components/ui/Icons.vue'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useRouter } from 'vue-router'

const game = useGameStore()
const router = useRouter()

// P3-2 快速操作入口
const quickActions = [
  { id: 'build', label: '建造', icon: 'i-nav-build', path: '/build', color: '#00E5FF' },
  { id: 'tech', label: '科技', icon: 'i-nav-tech', path: '/tech', color: '#A78BFA' },
  { id: 'explore', label: '探索', icon: 'i-nav-explore', path: '/map', color: '#2EE6A0' },
  { id: 'army', label: '部队', icon: 'i-nav-army', path: '/army', color: '#F43F5E' },
]

// P3-3 新手引导（HomeView 3 步）
const { activeStep, dismiss, skipAll } = useOnboarding('home', [
  'home-core',
  'home-quick',
  'home-actions',
])

// —— 核心视觉：核心能量值 + 产出率 ——
// 核心光晕大小随能量对数缩放（最小 48px，最大 120px）
const coreGlowSize = computed(() => {
  const energy = game.resources.getAmount('energy')
  if (energy.lte(0)) return 48
  const logVal = Math.log10(energy.toNumber())
  // log10(50)=1.7 → 48px, log10(1e6)=6 → ~90px, log10(1e12)=12 → 120px
  const size = Math.min(120, Math.max(48, 32 + logVal * 7.5))
  return Math.round(size)
})

// —— P2-3 核心环信息映射 ——
// 外环 r1 → 探索进度（completedNodes / totalNodes）
// 中环 r2 → 科技完成率（completedTechs / totalTechs）
// 内环 r3 → 能量等级（log10 分 4 档）
const exploreProgress = computed(() => {
  const total = EXPLORE_NODES.length
  const completed = game.exploration.count
  return total > 0 ? completed / total : 0
})
const techProgress = computed(() => {
  const total = TECHS.length
  const completed = game.research.count
  return total > 0 ? completed / total : 0
})
const energyPhase = computed(() => {
  const energy = game.resources.getAmount('energy')
  if (energy.lte(0)) return 0
  const logVal = Math.log10(energy.toNumber())
  if (logVal < 2) return 0 // <100
  if (logVal < 4) return 1 // <10K
  if (logVal < 8) return 2 // <100M
  return 3 // ≥100M
})

// P2-3 phase classes for rings
const r1Phase = computed(() => {
  const p = exploreProgress.value
  if (p >= 1) return 'phase-active'
  if (p > 0) return 'phase-progress'
  return 'phase-idle'
})
const r2Phase = computed(() => {
  const p = techProgress.value
  if (p >= 1) return 'phase-active'
  if (p > 0) return 'phase-progress'
  return 'phase-idle'
})
const r3Phase = computed(() => {
  const p = energyPhase.value
  if (p >= 3) return 'phase-active'
  if (p >= 1) return 'phase-progress'
  return 'phase-idle'
})

// P2-4 核心点击脉动
const coreClicked = ref(false)
function onCoreClick() {
  coreClicked.value = true
  setTimeout(() => {
    coreClicked.value = false
  }, 600)
  router.push('/build')
}

// 产出率（带 /s 后缀，负值时变红）
const rateDisplay = computed(() => {
  const rate = game.resources.getRate('energy')
  const formatted = fmtRate(rate)
  return formatted
})
const isNegativeRate = computed(() => game.resources.getRate('energy').lt(0))

// —— 文明概况 ——
const buildingsUnlocked = computed(() => {
  const completed = game.research.completed
  return BUILDINGS.filter((b) => !b.requires || completed.has(b.requires)).length
})
const techCompleted = computed(() => game.research.count)
const totalUnits = computed(() => game.military.totalUnits)
const relicsEquipped = computed(() => game.relics.equippedRelics.length)
const playTime = computed(() => fmtTime(game.totalPlayTime))

// 文明概况指标列表（P1-6 视觉层次）
interface OverviewItem {
  key: string
  label: string
  value: string
  icon: string
  color: string
}
const overviewItems = computed<OverviewItem[]>(() => {
  const items: OverviewItem[] = [
    {
      key: 'buildings',
      label: '建筑',
      value: `${buildingsUnlocked.value}/${BUILDINGS.length}`,
      icon: 'i-nav-build',
      color: 'var(--color-core)',
    },
    {
      key: 'tech',
      label: '科技',
      value: `${techCompleted.value}/${TECHS.length}`,
      icon: 'i-nav-tech',
      color: 'var(--color-plasma)',
    },
    {
      key: 'army',
      label: '部队',
      value: `${totalUnits.value}`,
      icon: 'i-nav-army',
      color: 'var(--color-alert)',
    },
    {
      key: 'relics',
      label: '遗物',
      value: `${relicsEquipped.value}/${game.relics.maxSlots}`,
      icon: 'i-nav-relic',
      color: 'var(--color-amber)',
    },
    {
      key: 'playtime',
      label: '时长',
      value: playTime.value,
      icon: 'i-ui-more',
      color: 'var(--color-t-primary)',
    },
  ]
  if (game.transcend.totalTranscends > 0) {
    items.push({
      key: 'transcends',
      label: '转生',
      value: `${game.transcend.totalTranscends}`,
      icon: 'i-nav-prestige',
      color: 'var(--color-amber)',
    })
  }
  return items
})

// —— P1-2 行动队列（合并 activeEvents + suggestions）——
interface ActionItem {
  id: string
  label: string
  detail: string
  path: string
  color: string
  icon: string
  status: 'in-progress' | 'actionable'
  progress?: number // 0~1，仅 in-progress 有
}

const actionQueue = computed<ActionItem[]>(() => {
  const items: ActionItem[] = []
  const completedTechs = game.research.completed

  // ===== 进行中（in-progress）=====

  // 1. 探索进行中
  for (const [nodeId, prog] of Object.entries(game.exploration.progress)) {
    if (prog.startTime === 0 || prog.completed) continue
    const node = getNode(nodeId)
    if (!node) continue
    const progress = game.exploration.getProgress(nodeId, game.exploreMult)
    items.push({
      id: `explore-${nodeId}`,
      label: `探索 ${node.name}`,
      detail: progress >= 1 ? '已完成' : `${Math.floor(progress * 100)}%`,
      path: '/map',
      color: '#2EE6A0',
      icon: 'i-nav-explore',
      status: 'in-progress',
      progress,
    })
  }

  // 2. 训练进行中
  for (const task of game.military.trainingQueue) {
    const unitDef = getUnit(task.unitId)
    if (!unitDef) continue
    const progress = 1 - task.remaining / task.totalTime
    items.push({
      id: `train-${task.id}`,
      label: `训练 ${unitDef.name} ×${task.count}`,
      detail: `${Math.floor(progress * 100)}%`,
      path: '/army',
      color: '#F43F5E',
      icon: unitDef.icon,
      status: 'in-progress',
      progress,
    })
  }

  // ===== 可执行（actionable）=====

  // 3. 可升级建筑（资源已够的）
  let upgradable = 0
  for (const b of BUILDINGS) {
    if (b.requires && !completedTechs.has(b.requires)) continue
    if (b.maxLevel && game.buildings.getLevel(b.id) >= b.maxLevel) continue
    const cost = game.buildings.getCost(b.id)
    if (game.resources.canAfford(cost)) upgradable++
  }
  if (upgradable > 0) {
    items.push({
      id: 'build-upgrade',
      label: `${upgradable} 个建筑可升级`,
      detail: '资源充足，立即升级',
      path: '/build',
      color: '#00E5FF',
      icon: 'i-nav-build',
      status: 'actionable',
    })
  }

  // 4. 可研究科技
  let researchable = 0
  for (const t of TECHS) {
    if (game.research.completed.has(t.id)) continue
    if (!game.research.available(t)) continue
    const mult = game.techCostMult.toNumber()
    const adjustedCost: Record<string, number> = {}
    for (const [k, v] of Object.entries(t.cost)) adjustedCost[k] = Math.ceil((v as number) * mult)
    if (game.resources.canAfford(adjustedCost)) researchable++
  }
  if (researchable > 0) {
    items.push({
      id: 'tech-research',
      label: `${researchable} 项科技可研究`,
      detail: '解锁新技术',
      path: '/tech',
      color: '#A78BFA',
      icon: 'i-nav-tech',
      status: 'actionable',
    })
  }

  // 5. 可探索节点
  const availableExplores = game.exploration.availableNodes()
  if (availableExplores.length > 0) {
    items.push({
      id: 'explore-available',
      label: `${availableExplores.length} 个星域待探索`,
      detail: '开拓新星域',
      path: '/map',
      color: '#2EE6A0',
      icon: 'i-nav-explore',
      status: 'actionable',
    })
  }

  // 6. 可训练引导（无训练任务时显示；训练进度由上方进行中条目承担，
  //    不再单独展示「N 支部队训练中」汇总卡（v0.49 起）
  if (
    game.military.trainingQueue.length === 0 &&
    (totalUnits.value > 0 || completedTechs.has('military_basic'))
  ) {
    items.push({
      id: 'army-train',
      label: '训练部队',
      detail: '增强军事实力',
      path: '/army',
      color: '#F43F5E',
      icon: 'i-nav-army',
      status: 'actionable',
    })
  }

  // 排序：in-progress 优先（插入序天然有序：探索 → 训练）→ actionable（建筑 > 科技 > 探索 > 军事）
  // 截断：进行中全保留（天然上限 7 = 4 探索 + 3 训练槽，进度信息不丢）；
  // 可执行补足至总数 ≤6（进行中 ≥6 时不显示可执行项）
  const inProgress = items.filter((i) => i.status === 'in-progress')
  const actionable = items
    .filter((i) => i.status === 'actionable')
    .slice(0, Math.max(0, 6 - inProgress.length))
  return [...inProgress, ...actionable]
})

// 空状态
const hasActions = computed(() => actionQueue.value.length > 0)

// 默认兜底（当无任何行动时，显示建造和研究两个入口）
const fallbackActions: ActionItem[] = [
  {
    id: 'fallback-build',
    label: '建造',
    detail: '升级建筑提升产能',
    path: '/build',
    color: '#00E5FF',
    icon: 'i-nav-build',
    status: 'actionable',
  },
  {
    id: 'fallback-tech',
    label: '研究',
    detail: '解锁新技术',
    path: '/tech',
    color: '#A78BFA',
    icon: 'i-nav-tech',
    status: 'actionable',
  },
]
const displayActions = computed(() => (hasActions.value ? actionQueue.value : fallbackActions))
</script>

<template>
  <div class="home">
    <Icons />

    <!-- 上部行：Hero + 行动队列并排（桌面）/ 堆叠（移动） -->
    <div class="home-top-row">
      <!-- 星核核心视觉 — 核心能量值 + 产出率（P1-1） -->
      <section class="hero" aria-label="星核核心">
        <!-- P3-3 onboarding: 核心引导 -->
        <OnboardingBubble
          v-if="activeStep === 'home-core'"
          class="onboard-core"
          title="星核核心"
          text="这是你的星核能量值，点击核心可快速进入建造页面。"
          @dismiss="dismiss"
          @skip="skipAll"
        />
        <div
          class="core-visual"
          :class="{ 'core-clicked': coreClicked }"
          role="button"
          tabindex="0"
          aria-label="星核核心，点击进入建造页面"
          @click="onCoreClick"
          @keydown.enter="onCoreClick"
        >
          <div class="core-ring r1" :class="r1Phase"></div>
          <div class="core-ring r2" :class="r2Phase"></div>
          <div class="core-ring r3" :class="r3Phase"></div>
          <div
            class="core-glow"
            :style="{ width: coreGlowSize + 'px', height: coreGlowSize + 'px' }"
          ></div>
          <div class="core-center">
            <div class="core-value font-display">{{ fmt(game.resources.getAmount('energy')) }}</div>
            <div class="core-label">星核能量</div>
          </div>
        </div>
        <div class="rate-display font-mono" :class="{ negative: isNegativeRate }">
          {{ rateDisplay }}
        </div>
        <!-- P2-9 视觉动线引导 — Hero 底部向下渐隐光柱 -->
        <div class="hero-flow" aria-hidden="true"></div>
      </section>

      <!-- 行动队列（P1-2 合并模块，P1-7 背景区分） -->
      <section class="action-queue" aria-labelledby="action-queue-title">
        <h3 id="action-queue-title" class="section-title">行动队列</h3>
        <!-- P3-3 onboarding: 行动队列引导 -->
        <OnboardingBubble
          v-if="activeStep === 'home-actions'"
          class="onboard-actions"
          title="行动队列"
          text="这里显示当前正在进行和可执行的操作，点击即可跳转。"
          @dismiss="dismiss"
          @skip="skipAll"
        />
        <ul class="action-list">
          <li
            v-for="item in displayActions"
            :key="item.id"
            class="action-item"
            :class="item.status"
            :style="{ '--c': item.color }"
          >
            <button class="action-btn" @click="router.push(item.path)">
              <!-- in-progress: 纯色图标 -->
              <svg
                v-if="item.status === 'in-progress'"
                class="action-icon"
                style="width: var(--icon-md); height: var(--icon-md)"
                aria-hidden="true"
              >
                <use :href="'#' + item.icon" />
              </svg>
              <!-- actionable: 色块 + 图标 -->
              <div v-else class="action-icon-block">
                <svg style="width: var(--icon-lg); height: var(--icon-lg)" aria-hidden="true">
                  <use :href="'#' + item.icon" />
                </svg>
              </div>
              <div class="action-info">
                <span class="action-label">{{ item.label }}</span>
                <span v-if="item.status === 'in-progress'" class="action-detail">{{
                  item.detail
                }}</span>
                <span v-else class="action-desc">{{ item.detail }}</span>
              </div>
              <svg
                class="action-arrow"
                style="width: var(--icon-sm); height: var(--icon-sm)"
                aria-hidden="true"
              >
                <use href="#i-ui-arrow-right" />
              </svg>
            </button>
            <!-- 进度条（仅 in-progress） -->
            <div
              v-if="item.status === 'in-progress' && item.progress !== undefined"
              class="action-progress"
            >
              <div class="action-progress-bar" :style="{ width: item.progress * 100 + '%' }"></div>
            </div>
          </li>
        </ul>
        <div v-if="!hasActions" class="action-empty empty-state">
          <span class="empty-text">星核静默中，等待你的指令…</span>
        </div>
      </section>
    </div>

    <!-- P3-2 快速操作入口 — Hero 下方一行 4 个等宽紧凑按钮 -->
    <section class="quick-actions" aria-label="快速操作">
      <!-- P3-3 onboarding: 快速操作引导 -->
      <OnboardingBubble
        v-if="activeStep === 'home-quick'"
        class="onboard-quick"
        title="快速操作"
        text="点击下方按钮可快速进入建造、科技、探索、部队页面。"
        @dismiss="dismiss"
        @skip="skipAll"
      />
      <button
        v-for="action in quickActions"
        :key="action.id"
        class="quick-action-btn btn-secondary sm"
        :style="{ '--c': action.color }"
        @click="router.push(action.path)"
      >
        <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
          <use :href="'#' + action.icon" />
        </svg>
        <span>{{ action.label }}</span>
      </button>
    </section>

    <!-- 文明概况（P1-6 视觉层次，P1-3 桌面 6 列） -->
    <section class="overview" aria-labelledby="overview-title">
      <h3 id="overview-title" class="section-title">文明概况</h3>
      <ul class="overview-grid">
        <li
          v-for="item in overviewItems"
          :key="item.key"
          class="ov-item"
          :style="{ '--ov-color': item.color }"
        >
          <div class="ov-top">
            <svg
              class="ov-icon"
              style="width: var(--icon-sm); height: var(--icon-sm)"
              aria-hidden="true"
            >
              <use :href="'#' + item.icon" />
            </svg>
            <span class="ov-value font-mono" :style="{ color: item.color }">{{ item.value }}</span>
          </div>
          <span class="ov-label">{{ item.label }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: screenIn 0.4s var(--ease-out);
}

/* —— P1-3 桌面端双列布局 —— */
/* 覆盖 AppShell .content max-width，仅在 HomeView 内生效，不影响其他 View */
:deep(.content) {
  max-width: 720px;
}
.home-top-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
@media (min-width: 768px) {
  :deep(.content) {
    max-width: 1040px;
  }
  .home {
    gap: var(--space-6);
  }
  .home-top-row {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: var(--space-6);
    align-items: start;
  }
  .home-top-row .hero {
    position: sticky;
    top: var(--space-6);
  }
}

/* —— P1-1 星核核心视觉 —— */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) 0 var(--space-4);
  position: relative;
}
.core-visual {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s var(--ease-out);
}
.core-visual:hover {
  transform: scale(1.02);
}
.core-visual:active {
  transform: scale(0.95);
} /* P2-4 */
/* P2-4 核心点击额外脉动 */
.core-visual.core-clicked {
  animation: coreClickPulse 0.6s var(--ease-out);
}

/* P1-1 外层渗透光晕 */
.core-visual::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 240px;
  height: 240px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(0, 229, 255, 0.15) 0%,
    rgba(0, 229, 255, 0.06) 40%,
    transparent 70%
  );
  filter: blur(8px);
  pointer-events: none;
  z-index: 0;
  animation: corePulse 3s ease-in-out infinite;
}

/* P2-3 核心环信息映射 — 3 层环映射游戏状态 */
.core-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid;
  z-index: 1;
  transition:
    opacity 0.4s var(--ease-out),
    border-color 0.4s var(--ease-out);
}
/* phase-idle: 低透明度、慢速旋转 */
.core-ring.phase-idle {
  opacity: 0.2;
}
/* phase-progress: 中透明度、正常旋转、主色 */
.core-ring.phase-progress {
  opacity: 0.5;
}
/* phase-active: 高透明度、加速旋转、辅色发光 */
.core-ring.phase-active {
  opacity: 0.8;
}

.r1 {
  width: 100%;
  height: 100%;
  border-color: var(--color-quantum); /* 探索 → 绿 */
  animation: spinRing 20s linear infinite;
}
.r1.phase-active {
  border-color: var(--color-quantum);
  box-shadow: 0 0 12px rgba(46, 230, 160, 0.3);
  animation-duration: 12s;
}
.r1.phase-progress {
  animation-duration: 16s;
}

.r2 {
  width: 75%;
  height: 75%;
  border-style: dashed;
  border-color: var(--color-plasma); /* 科技 → 紫 */
  animation: spinRing 15s linear infinite reverse;
}
.r2.phase-active {
  border-color: var(--color-plasma);
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.3);
  animation-duration: 8s;
}
.r2.phase-progress {
  animation-duration: 12s;
}

.r3 {
  width: 50%;
  height: 50%;
  border-color: var(--color-amber); /* 能量 → 琥珀 */
  animation: spinRing 10s linear infinite;
}
.r3.phase-active {
  border-color: var(--color-amber);
  box-shadow: 0 0 8px rgba(255, 182, 39, 0.3);
  animation-duration: 6s;
}
.r3.phase-progress {
  animation-duration: 8s;
}

.core-glow {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(0, 229, 255, 0.6) 0%,
    rgba(0, 107, 122, 0.3) 60%,
    transparent 100%
  );
  filter: blur(16px);
  animation: corePulse 3s ease-in-out infinite;
  z-index: 1;
}
.core-center {
  position: relative;
  z-index: 2;
  text-align: center;
}
.core-value {
  font-size: var(--text-2xl);
  font-weight: 900;
  color: var(--color-t-primary);
  text-shadow: 0 0 16px rgba(0, 229, 255, 0.5);
}
.core-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-top: var(--space-1);
}
.rate-display {
  font-size: var(--text-sm);
  color: var(--color-core);
  font-weight: 500;
  letter-spacing: 0.5px;
}
.rate-display.negative {
  color: var(--color-alert);
}

/* P2-9 视觉动线引导 — Hero 底部向下渐隐光柱 */
.hero-flow {
  position: absolute;
  bottom: calc(-1 * var(--space-6));
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 60px;
  background: linear-gradient(
    to bottom,
    rgba(0, 229, 255, 0.15) 0%,
    rgba(0, 229, 255, 0.05) 50%,
    transparent 100%
  );
  filter: blur(4px);
  border-radius: 50%;
  pointer-events: none;
  animation: flowPulse 2.5s ease-in-out infinite;
}

/* P1-1 桌面端差异 */
@media (min-width: 768px) {
  .core-visual {
    width: 240px;
    height: 240px;
  }
  .core-visual::after {
    width: 288px;
    height: 288px;
  }
  .core-glow {
    width: 96px;
    height: 96px;
  }
  .core-value {
    font-size: var(--text-display);
    text-shadow: 0 0 24px rgba(0, 229, 255, 0.5);
  }
  .hero {
    padding: var(--space-8) 0 var(--space-6);
  }
}

/* —— P3-4 四档响应断点 —— */
/* L 断点（1024-1439px）：双列比 38/62，核心视觉 260 */
@media (min-width: 1024px) {
  :deep(.content) {
    max-width: 1280px;
  }
  .home-top-row {
    grid-template-columns: 38% 62%;
  }
  .core-visual {
    width: 260px;
    height: 260px;
  }
  .core-visual::after {
    width: 312px;
    height: 312px;
  }
}
/* XL 断点（≥1440px）：双列比 33/67，核心视觉 260（封顶） */
@media (min-width: 1440px) {
  :deep(.content) {
    max-width: 1440px;
  }
  .home-top-row {
    grid-template-columns: 33% 67%;
  }
}

/* —— P1-2 行动队列 —— */
.action-queue {
  background: rgba(0, 229, 255, 0.02);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.action-item {
  width: 100%;
  position: relative;
  overflow: hidden;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  transition: all 0.2s var(--ease-out);
  position: relative;
}

/* —— 进行中（in-progress）—— */
.action-item.in-progress {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--c);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
  animation: actionPulse 2s ease-in-out infinite;
}
.action-item.in-progress .action-icon {
  color: var(--c);
  flex-shrink: 0;
}
.action-item.in-progress .action-info {
  flex: 1;
  text-align: left;
  min-width: 0;
}
.action-item.in-progress .action-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-t-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-item.in-progress .action-detail {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-item.in-progress .action-arrow {
  color: var(--color-t-tertiary);
  flex-shrink: 0;
}
.action-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-elevated);
}
.action-progress-bar {
  height: 100%;
  background: var(--c);
  border-radius: 0 2px 2px 0;
  transition: width 0.5s var(--ease-out);
  box-shadow: 0 0 4px var(--c);
}

/* —— 可执行（actionable）—— */
.action-item.actionable {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  transition: all 0.2s var(--ease-out);
}
.action-item.actionable:hover {
  transform: translateY(-2px); /* P2-4 */
  background: var(--color-hover);
  border-color: var(--color-border-glow);
  box-shadow:
    var(--elevation-2),
    /* P2-6 */ 0 0 0 1px color-mix(in srgb, var(--c) 20%, transparent);
}
.action-item.actionable:active {
  transform: translateY(0) scale(0.95); /* P2-4 */
}
.action-item.actionable .action-icon-block {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--c) 15%, transparent);
  color: var(--c);
  flex-shrink: 0;
}
.action-item.actionable .action-info {
  flex: 1;
  text-align: left;
}
.action-item.actionable .action-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-t-primary);
}
.action-item.actionable .action-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-top: var(--space-1);
  display: block;
}
.action-item.actionable .action-arrow {
  color: var(--color-t-tertiary);
  flex-shrink: 0;
  opacity: 0;
  transition:
    opacity 0.2s var(--ease-out),
    transform 0.2s var(--ease-out);
}
.action-item.actionable:hover .action-arrow {
  opacity: 1;
  transform: translateX(2px);
}

/* 空状态 */
.action-empty {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--color-t-tertiary);
  font-size: var(--text-sm);
}

/* P1-2 桌面端适配 */
@media (min-width: 768px) {
  .action-list {
    gap: var(--space-3);
  }
}

/* —— P1-6 文明概况 —— */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.ov-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--ov-color, var(--color-core));
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  transition: all 0.2s var(--ease-out);
  box-shadow: var(--elevation-1); /* P2-6 */
}
.ov-item:hover {
  background: var(--color-hover);
  border-color: var(--color-border-glow);
  transform: translateY(-2px); /* P2-4 */
  box-shadow: var(--elevation-2); /* P2-6 */
}
.ov-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}
.ov-icon {
  color: var(--ov-color, var(--color-core));
  flex-shrink: 0;
}
.ov-value {
  font-size: var(--text-sm);
  font-weight: 600;
}
.ov-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  text-align: center;
}

/* P1-6 桌面端 6 列横排 */
@media (min-width: 768px) {
  .overview-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: var(--space-3);
  }
  .ov-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
  .ov-top {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
  }
  .ov-value {
    font-size: var(--text-base);
  }
}

/* —— P3-2 快速操作入口 —— */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  position: relative;
}
.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-t-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  transition: all 0.15s var(--ease-out);
  cursor: pointer;
}
.quick-action-btn svg {
  color: var(--c, var(--color-t-secondary));
}
.quick-action-btn:hover {
  border-color: var(--c, var(--color-core));
  color: var(--color-t-primary);
  background: var(--color-elevated);
}
.quick-action-btn:active {
  transform: scale(0.95);
}

/* —— P3-3 onboarding 气泡定位 —— */
.onboard-core {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(260px, 80vw);
  z-index: 10;
}
.onboard-quick {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: min(260px, 80vw);
  margin-bottom: var(--space-2);
  z-index: 10;
}
.onboard-actions {
  position: relative;
  width: 100%;
  margin-bottom: var(--space-3);
}
</style>
