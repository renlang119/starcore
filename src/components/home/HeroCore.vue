<script setup lang="ts">
// HeroCore — 星核核心视觉（v0.54 从 HomeView 拆出）
// v1.40 五资源五角环绕；v1.41 中央圆形视觉（状态环/光晕/圆心产率）整体移除——
// 五资源已按节点分开显示（含名称），点击节点区仍可跳建造页
import { t } from '@/i18n'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTimeout } from '@/composables/useTimeout'
import { useGameStore } from '@/stores/game'
import { fmt, fmtRate } from '@/lib/format'
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

// —— 五资源节点（正五角形环绕，顶点朝上，各自显示名称）——
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

// 节点区点击脉动（重触发先清旧；卸载清理由 useTimeout 承载）+ 跳建造页
const stageClicked = ref(false)
const clickTimer = useTimeout()
function onStageClick() {
  stageClicked.value = true
  clickTimer.set(() => {
    stageClicked.value = false
  }, 600)
  router.push('/build')
}

// 终局贺词：全宇宙探索完毕（34/34）时显示一次性的终章贺词（D11）
const allExplored = computed(
  () => EXPLORE_NODES.length > 0 && EXPLORE_NODES.every((n) => game.exploration.isCompleted(n.id))
)

// 读屏摘要：首页顶栏资源条隐藏（v1.43），资源信息经此段对读屏可见
const srSummary = computed(() =>
  resNodes.value.map((n) => `${n.name} ${n.amount} ${n.rate}`).join('；')
)
</script>

<template>
  <!-- 星核核心视觉 — 五资源节点正五角形环绕 -->
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
    <!-- 读屏摘要：首页顶栏资源条隐藏后，资源信息经此段可达（v1.43） -->
    <p class="sr-only">{{ srSummary }}</p>
    <div
      class="hero-stage"
      :class="{ 'stage-clicked': stageClicked }"
      role="button"
      tabindex="0"
      :aria-label="t('home.hero.buttonAria')"
      @click="onStageClick"
      @keydown.enter="onStageClick"
      @keydown.space.prevent="onStageClick"
    >
      <!-- 五资源节点：图标 + 数值 + 名称 + 产率小字 -->
      <!-- 资源信息顶栏已有读屏名称，节点对读屏隐藏 -->
      <div
        v-for="n in resNodes"
        :key="n.id"
        class="res-node"
        :class="['pos-' + n.id, { 'node-zero': n.zero }]"
        :style="{ '--c': n.color }"
        :title="`${n.name} ${n.amount} ${n.rate}`"
        aria-hidden="true"
      >
        <Icon class="node-icon" :name="n.icon" size="sm" />
        <span class="node-value font-mono">{{ n.amount }}</span>
        <span class="node-name">{{ n.name }}</span>
        <span class="node-rate font-mono">{{ n.rate }}</span>
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
/* 五角形舞台：五节点按坐标环绕（v1.41 中央圆移除后节点区承接点击跳建造页；
   v1.42 节点图形改圆形，舞台随节点直径加宽加高） */
.hero-stage {
  position: relative;
  width: 280px;
  height: 272px;
  cursor: pointer;
  transition: transform 0.2s var(--ease-out);
}
.hero-stage:active {
  transform: scale(0.98);
}
/* 点击脉动反馈 */
.hero-stage.stage-clicked {
  animation: coreClickPulse 0.6s var(--ease-out);
}

/* 五资源节点：圆形徽章（含零值弱化；新档四资源与暗物质长期为 0 呈弱化态） */
.res-node {
  position: absolute;
  left: calc(50% + var(--dx, 0px));
  top: calc(50% + var(--dy, 0px));
  transform: translate(-50%, -50%);
  width: 88px;
  height: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  border-radius: 50%;
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
.node-name {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.2;
}
.node-rate {
  font-size: var(--text-xs);
  color: var(--c);
  opacity: 0.9;
  line-height: 1.2;
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

/* 桌面端差异（≥768px：R=120、圆形节点与舞台同步放大） */
@media (min-width: 768px) {
  .hero {
    padding: var(--space-8) 0 var(--space-6);
  }
  .hero-stage {
    width: 328px;
    height: 320px;
  }
  .res-node {
    width: 100px;
    height: 100px;
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
