<script setup lang="ts">
// HeroCore — 星核核心视觉（v0.54 从 HomeView 拆出）
// v1.40 五资源五角环绕：核心缩至 110/130px，五资源节点按正五角形环绕，
// 能量居顶点（数值+小标），圆心改显能量产率；三层状态环与跳建造页保留
import { t } from '@/i18n'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTimeout } from '@/composables/useTimeout'
import { useGameStore } from '@/stores/game'
import { fmt, fmtRate } from '@/lib/format'
import { TECHS } from '@/data/tech'
import { EXPLORE_NODES } from '@/data/explore'
import type { ResourceType } from '@/data/buildings'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import Icon from '@/components/ui/Icon.vue'

defineProps<{
  /** 当前应显示的引导 step（null 表示不显示） */
  activeStep?: string | null
}>()
const emit = defineEmits<{
  dismiss: []
  skip: []
}>()

const game = useGameStore()
const router = useRouter()

// —— 核心视觉：圆心能量产率 ——
// 核心光晕大小随能量对数缩放（最小 48px，最大 120px）
const coreGlowSize = computed(() => {
  const energy = game.resources.getAmount('energy')
  if (energy.lte(0)) return 48
  const logVal = Math.log10(energy.toNumber())
  // log10(50)=1.7 → 48px（下限钳制），log10(1e6)=6 → 77px，log10(1e12)=12 → 120px（封顶）
  const size = Math.min(120, Math.max(48, 32 + logVal * 7.5))
  return Math.round(size)
})

// —— 五资源节点（正五角形环绕，顶点朝上）——
// 布位即资源解锁顺序：能量顶点、晶体/合金两肩、数据流/暗物质底边
const NODE_IDS: ResourceType[] = ['energy', 'crystal', 'alloy', 'data', 'dark']
const resNodes = computed(() =>
  NODE_IDS.map((id) => {
    const meta = game.resources.getMeta(id)
    const amount = game.resources.getAmount(id)
    return {
      id,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      amount: fmt(amount),
      rate: fmtRate(game.resources.getRate(id)),
      zero: amount.lte(0),
    }
  })
)

// —— 核心环信息映射 ——
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

// phase classes for rings
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

// 核心点击脉动（重触发先清旧；卸载清理由 useTimeout 承载）
const coreClicked = ref(false)
const clickTimer = useTimeout()
function onCoreClick() {
  coreClicked.value = true
  clickTimer.set(() => {
    coreClicked.value = false
  }, 600)
  router.push('/build')
}

// 产出率（带 /s 后缀，负值时变红；v1.40 移至圆心显示）
const rateDisplay = computed(() => {
  const rate = game.resources.getRate('energy')
  const formatted = fmtRate(rate)
  return formatted
})
const isNegativeRate = computed(() => game.resources.getRate('energy').lt(0))

// 终局贺词：全宇宙探索完毕（34/34）时显示一次性的终章贺词（D11）
const allExplored = computed(
  () => EXPLORE_NODES.length > 0 && EXPLORE_NODES.every((n) => game.exploration.isCompleted(n.id))
)
</script>

<template>
  <!-- 星核核心视觉 — 五资源五角环绕 + 圆心能量产率 -->
  <section class="hero" :aria-label="t('home.hero.aria')">
    <!-- onboarding: 核心引导 -->
    <OnboardingBubble
      v-if="activeStep === 'home-core'"
      class="ob-core"
      :title="t('home.hero.aria')"
      :text="t('home.hero.onboarding')"
      @dismiss="emit('dismiss')"
      @skip="emit('skip')"
    />
    <div class="hero-stage">
      <div
        class="core-visual"
        :class="{ 'core-clicked': coreClicked }"
        role="button"
        tabindex="0"
        :aria-label="t('home.hero.buttonAria')"
        @click="onCoreClick"
        @keydown.enter="onCoreClick"
        @keydown.space.prevent="onCoreClick"
      >
        <div class="core-ring r1" :class="r1Phase"></div>
        <div class="core-ring r2" :class="r2Phase"></div>
        <div class="core-ring r3" :class="r3Phase"></div>
        <div
          class="core-glow"
          :style="{ width: coreGlowSize + 'px', height: coreGlowSize + 'px' }"
        ></div>
        <div class="rate-display font-mono" :class="{ negative: isNegativeRate }">
          {{ rateDisplay }}
        </div>
      </div>
      <!-- 五资源节点：正五角形环绕，能量居顶点（数值+小标，产率在圆心不重复） -->
      <!-- 资源信息顶栏已有读屏名称，节点对读屏隐藏 -->
      <div
        v-for="n in resNodes"
        :key="n.id"
        class="res-node"
        :class="['pos-' + n.id, { 'node-energy': n.id === 'energy', 'node-zero': n.zero }]"
        :style="{ '--c': n.color }"
        :title="`${n.name} ${n.amount} ${n.rate}`"
        aria-hidden="true"
      >
        <Icon class="node-icon" :name="n.icon" size="sm" />
        <span class="node-value font-mono">{{ n.amount }}</span>
        <span v-if="n.id === 'energy'" class="node-label">{{ t('home.hero.coreLabel') }}</span>
        <span v-else class="node-rate font-mono">{{ n.rate }}</span>
      </div>
    </div>
    <p v-if="allExplored" class="final-salute">{{ t('home.hero.finalSalute') }}。</p>
    <!-- 视觉动线引导 — Hero 底部向下渐隐光柱 -->
    <div class="hero-flow" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
/* —— 星核核心视觉 —— */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) 0 var(--space-4);
  position: relative;
}
/* 五角形舞台：核心居中，五节点按坐标环绕（v1.40） */
.hero-stage {
  position: relative;
  width: 260px;
  height: 248px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.core-visual {
  position: relative;
  width: 110px;
  height: 110px;
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
}
/* 核心点击额外脉动 */
.core-visual.core-clicked {
  animation: coreClickPulse 0.6s var(--ease-out);
}

/* 外层渗透光晕 */
.core-visual::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150px;
  height: 150px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-core) 15%, transparent) 0%,
    color-mix(in srgb, var(--color-core) 6%, transparent) 40%,
    transparent 70%
  );
  filter: blur(8px);
  pointer-events: none;
  z-index: 0;
  animation: corePulse 3s ease-in-out infinite;
}

/* 圆心产率（v1.40 中心大数字移除后改显产率） */
.core-visual .rate-display {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  font-size: var(--text-sm);
  white-space: nowrap;
  text-shadow: 0 0 8px color-mix(in srgb, var(--color-core) 40%, transparent);
}

/* 五资源节点（含零值弱化；新档四资源与暗物质长期为 0 呈弱化态） */
.res-node {
  position: absolute;
  left: calc(50% + var(--dx, 0px));
  top: calc(50% + var(--dy, 0px));
  transform: translate(-50%, -50%);
  z-index: 3;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: var(--space-1) 0;
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-1);
  transition: opacity 0.4s var(--ease-out);
}
.node-icon {
  color: var(--c);
}
.node-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-t-primary);
  line-height: 1.2;
}
.node-rate {
  font-size: var(--text-xs);
  color: var(--c);
  opacity: 0.9;
  line-height: 1.2;
}
.node-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.2;
}
/* 能量节点稍大（顶点地位 + 小标） */
.node-energy {
  width: 64px;
  gap: 2px;
  border-color: color-mix(in srgb, var(--c) 60%, transparent);
}
.node-zero {
  opacity: 0.35;
}

/* 五点坐标（正五角形顶点朝上，外接圆半径 R=100） */
.pos-energy {
  --dx: 0px;
  --dy: -100px;
}
.pos-crystal {
  --dx: 95px;
  --dy: -31px;
}
.pos-alloy {
  --dx: -95px;
  --dy: -31px;
}
.pos-data {
  --dx: 59px;
  --dy: 81px;
}
.pos-dark {
  --dx: -59px;
  --dy: 81px;
}

/* 核心环信息映射 — 3 层环映射游戏状态 */
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
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-quantum) 30%, transparent);
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
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-plasma) 30%, transparent);
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
  box-shadow: 0 0 8px color-mix(in srgb, var(--color-amber) 30%, transparent);
  animation-duration: 6s;
}
.r3.phase-progress {
  animation-duration: 8s;
}

.core-glow {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-core) 60%, transparent) 0%,
    color-mix(in srgb, var(--color-core-deep) 30%, transparent) 60%,
    transparent 100%
  );
  filter: blur(16px);
  animation: corePulse 3s ease-in-out infinite;
  z-index: 1;
}

.rate-display {
  color: var(--color-core);
  font-weight: 500;
  letter-spacing: 0.5px;
}
.rate-display.negative {
  color: var(--color-alert);
}

/* 视觉动线引导 — Hero 底部向下渐隐光柱 */
.hero-flow {
  position: absolute;
  bottom: calc(-1 * var(--space-6));
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 60px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--color-core) 15%, transparent) 0%,
    color-mix(in srgb, var(--color-core) 5%, transparent) 50%,
    transparent 100%
  );
  filter: blur(4px);
  border-radius: 50%;
  pointer-events: none;
  animation: flowPulse 2.5s ease-in-out infinite;
}

.final-salute {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  text-align: center;
  max-width: 34em;
}

/* 桌面端差异（≥768px：核心 130、R=120、节点与舞台同步放大） */
@media (min-width: 768px) {
  .core-visual {
    width: 130px;
    height: 130px;
  }
  .core-visual::after {
    width: 176px;
    height: 176px;
  }
  .hero {
    padding: var(--space-8) 0 var(--space-6);
  }
  .hero-stage {
    width: 320px;
    height: 296px;
  }
  .res-node {
    width: 60px;
  }
  .node-energy {
    width: 70px;
  }
  .pos-energy {
    --dy: -120px;
  }
  .pos-crystal {
    --dx: 114px;
    --dy: -37px;
  }
  .pos-alloy {
    --dx: -114px;
    --dy: -37px;
  }
  .pos-data {
    --dx: 71px;
    --dy: 97px;
  }
  .pos-dark {
    --dx: -71px;
    --dy: 97px;
  }
}

/* —— onboarding 气泡定位（变体类承载定位与层级，v0.97）—— */
.ob-core {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(260px, 80vw);
  z-index: 60;
}
</style>
