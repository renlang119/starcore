<!-- src/components/layout/LayerCompleteCeremony.vue -->
<script setup lang="ts">
/**
 * LayerCompleteCeremony.vue：层完成仪式（v1.55）
 *
 * 消费 exploration store 的层完成仪式队列：普通层播顶部横幅
 * （层色光边 + 层名，约 3.5 秒自动消失、点击提前关闭）；
 * 深空层（最后一层，完成即全宇宙探索完毕）改播终局全屏仪式。
 * 挂载于 AppShell，所有路由下可见。
 */
import { t } from '@/i18n'
import { ref, computed, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { LAYER_INFO, type StarLayer } from '@/data/explore'
import { useTimeout } from '@/composables/useTimeout'
import CeremonyOverlay from '@/components/ui/CeremonyOverlay.vue'

const game = useGameStore()
const SHOW_MS = 3500
const FINALE_LAYER: StarLayer = 'void'

const current = ref<StarLayer | null>(null)
const timer = useTimeout()

const isFinale = computed(() => current.value === FINALE_LAYER)
const layerInfo = computed(() => (current.value ? LAYER_INFO[current.value] : null))

function dismiss() {
  timer.clear()
  game.exploration.shiftLayerCeremony()
}

function showNext() {
  timer.clear()
  const layer = game.exploration.layerCeremonyQueue[0]
  if (!layer) {
    current.value = null
    return
  }
  current.value = layer
  // 终局仪式由 CeremonyOverlay 自管自动关闭，横幅在此计时
  if (layer !== FINALE_LAYER) timer.set(dismiss, SHOW_MS)
}

// watch 队列长度：新增与 shift 后都会触发 showNext 链式推进
watch(() => game.exploration.layerCeremonyQueue.length, showNext, { immediate: true })
</script>

<template>
  <CeremonyOverlay
    v-if="isFinale"
    :title="t('map.allDoneTitle')"
    accent="var(--color-layer-void)"
    icon="i-nav-explore"
    @close="dismiss"
  >
    <p class="finale-salute">{{ t('home.hero.finalSalute') }}</p>
  </CeremonyOverlay>
  <transition v-else name="layer-banner">
    <div
      v-if="current && layerInfo"
      class="layer-banner"
      role="status"
      aria-live="polite"
      :style="{ '--layer-color': layerInfo.color }"
      @click="dismiss"
    >
      <span class="banner-text">{{ t('map.layerComplete', { layer: layerInfo.name }) }}</span>
    </div>
  </transition>
</template>

<style scoped>
.finale-salute {
  font-size: var(--text-sm);
  line-height: 1.8;
  color: var(--color-t-primary);
  max-width: 300px;
}

.layer-banner {
  position: fixed;
  top: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  /* 定宽 shrink-to-fit 会按左缘剩余宽度收窄致文案折行，须显式内容宽 */
  width: max-content;
  z-index: 400;
  background: var(--color-surface);
  border: 1px solid var(--layer-color);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-5);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 16px color-mix(in srgb, var(--layer-color) 25%, transparent);
  cursor: pointer;
  max-width: min(340px, calc(100vw - 2 * var(--space-4)));
  text-align: center;
}
/* 移动端：置于顶栏（实测高 49px）之下，与成就提示同位避让 */
@media (max-width: 767px) {
  .layer-banner {
    top: calc(49px + var(--space-2));
  }
}
.banner-text {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--layer-color);
}

.layer-banner-enter-active,
.layer-banner-leave-active {
  transition:
    opacity 0.25s var(--ease-out),
    transform 0.25s var(--ease-out);
}
.layer-banner-enter-from,
.layer-banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}
@media (prefers-reduced-motion: reduce) {
  .layer-banner-enter-active,
  .layer-banner-leave-active {
    transition: opacity 0.15s ease;
  }
  .layer-banner-enter-from,
  .layer-banner-leave-to {
    transform: translate(-50%, 0);
  }
}
</style>
