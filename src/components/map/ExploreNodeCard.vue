<script setup lang="ts">
/**
 * ExploreNodeCard.vue — 星图探索节点卡。
 *
 * 从 MapView 拆出：按状态渲染（进行中 / 待探索 / 已锁定 / 已完成）、
 * 进度条、成本与奖励预览。类名与文案保持不变。
 */
import { t } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { fmtTime } from '@/lib/format'
import { EXPLORE_NODES } from '@/data/explore'
import type { ExploreNode } from '@/data/explore'
import type { ResourceRow } from '@/lib/resource-rows'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import CostTag from '@/components/ui/CostTag.vue'
import Icon from '@/components/ui/Icon.vue'

defineProps<{
  node: ExploreNode
  completed: boolean
  exploring: boolean
  locked: boolean
  progressPct: number
  rewards: ResourceRow[]
  /** 所在星层配色（节点圆点与进度条填充） */
  layerColor: string
}>()

const emit = defineEmits<{ explore: [nodeId: string] }>()

const game = useGameStore()
</script>

<template>
  <div class="node-card" :class="{ completed, exploring, locked }">
    <div class="n-head">
      <div class="n-dot" :style="{ background: layerColor }"></div>
      <div class="n-name">{{ node.name }}</div>
      <span v-if="completed" class="n-done">
        <Icon name="i-ui-check" size="sm" />
      </span>
    </div>
    <p class="n-desc">{{ node.desc }}</p>

    <!-- 探索进度 -->
    <div v-if="exploring" class="n-progress">
      <ProgressBar
        class="progress-bar"
        fill-class="progress-fill"
        :pct="progressPct"
        :fill="layerColor"
      />
      <span class="progress-text font-mono">{{ Math.floor(progressPct) }}%</span>
    </div>

    <!-- 成本 -->
    <div v-else-if="!completed && !locked" class="n-info">
      <div class="n-cost">
        <CostTag :cost="node.cost" />
        <span class="time-tag font-mono">{{
          fmtTime(node.time / game.exploreMult.toNumber())
        }}</span>
      </div>
      <button
        class="btn-accent sm"
        style="--accent: var(--color-quantum)"
        :disabled="!game.resources.canAfford(node.cost)"
        @click="emit('explore', node.id)"
      >
        {{ t('map.explore') }}
      </button>
    </div>

    <!-- 锁定 -->
    <div v-else-if="locked" class="n-locked">
      {{ t('map.needsPrereq')
      }}{{
        (node.requires ?? []).map((r) => EXPLORE_NODES.find((x) => x.id === r)?.name).join(', ')
      }}
    </div>

    <!-- 已完成奖励预览 -->
    <div v-if="completed" class="n-rewards">
      <span class="rewards-label">{{ t('map.obtained') }}</span>
      <span v-for="r in rewards" :key="r.name" class="reward-tag" :style="{ color: r.color }"
        >{{ r.name }} +{{ r.amount }}</span
      >
    </div>
  </div>
</template>

<style scoped>
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
</style>
