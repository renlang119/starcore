<script setup lang="ts">
/**
 * ProgressBar.vue — 通用进度条（轨道 + 填充）
 *
 * 收敛 MapView / ArmyView / AchievementsView / DailyCard / ActionQueuePanel
 * 五处同构实现（v1.02）。调用方类名自动落在组件根节点，填充条类名经
 * fillClass 保留（单测与 Playwright 锚点不变）；高度/配色/圆角/过渡/辉光
 * 经 `--pb-*` 变量在调用方 scoped 规则里注入（缺省值见样式段）。
 * 根节点溢出裁剪同样走变量：带辉光的实例（如行动队列底部细条）注入
 * `--pb-overflow: visible`，否则光晕会被裁平。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 进度百分比（0-100） */
    pct: number
    /** 填充条附加类名（保留既有断言锚点） */
    fillClass?: string
    /** 填充色（缺省走 --pb-fill 变量）；按层着色等逐实例场景使用 */
    fill?: string
  }>(),
  { fillClass: '', fill: undefined }
)

const width = computed(() => props.pct + '%')
</script>

<template>
  <div class="pb">
    <div class="pb-fill" :class="fillClass" :style="{ width, background: fill }"></div>
  </div>
</template>

<style scoped>
.pb {
  height: var(--pb-h, 6px);
  background: var(--pb-track, var(--color-elevated));
  border-radius: var(--pb-radius, var(--radius-pill, 999px));
  overflow: var(--pb-overflow, hidden);
}
.pb-fill {
  height: 100%;
  background: var(--pb-fill, var(--color-core));
  border-radius: var(--pb-fill-radius, var(--pb-radius, var(--radius-pill, 999px)));
  transition: var(--pb-transition, width 0.3s);
  box-shadow: var(--pb-glow, none);
}
</style>
