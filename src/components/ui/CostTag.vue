<script setup lang="ts">
/**
 * CostTag.vue — 通用成本标签组件 (6.6)
 *
 * 提取 BuildView / TechView / ArmyView 中重复的成本标签 UI 模式。
 * 根据当前资源量自动判断 enough / not-enough 状态。
 */
import { useResourcesStore } from '@/stores/resources'
import { fmt } from '@/lib/format'
import { computed } from 'vue'

const props = defineProps<{
  /** 成本字典 { resourceId: amount } */
  cost: Record<string, number>
}>()

const resources = useResourcesStore()

const items = computed(() =>
  Object.entries(props.cost).map(([k, v]) => ({
    key: k,
    value: v,
    enough: resources.canAfford({ [k]: v }),
    icon: resources.allMeta[k as keyof typeof resources.allMeta]?.icon ?? '',
    name: resources.allMeta[k as keyof typeof resources.allMeta]?.name ?? k,
  }))
)
</script>

<template>
  <span
    v-for="item in items"
    :key="item.key"
    class="cost-tag"
    :class="item.enough ? 'enough' : 'not-enough'"
  >
    <svg v-if="item.icon" style="width: var(--icon-xs); height: var(--icon-xs)" aria-hidden="true">
      <use :href="'#' + item.icon" />
    </svg>
    {{ fmt(item.value) }}
  </span>
</template>

<style scoped>
.cost-tag {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
}
.cost-tag.enough {
  color: var(--color-t-primary);
}
.cost-tag.not-enough {
  color: var(--color-amber); /* P2-7：资源不足可逆，警告级而非危险 */
}
</style>
