<script setup lang="ts">
/**
 * Icon.vue — symbol 图标引用（v1.07 收敛自全站重复的 svg + use 形态）
 *
 * 根节点即 <svg>、子节点保留 <use> 结构（v078 的 querySelector('use') 断言
 * 与 v079/v091 的 .t-icon use 消费点核验依赖此形态）；类名与其余属性经
 * 透传合并到根节点。未传 size 时尺寸由调用方类名（如 .b-icon）承载。
 */
defineProps<{
  /** symbol id（如 'i-nav-build'） */
  name: string
  /** 尺寸档位（对应 --icon-* Token）；不传则由调用方类名承载 */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}>()
</script>

<template>
  <svg
    :style="size ? `width: var(--icon-${size}); height: var(--icon-${size})` : undefined"
    aria-hidden="true"
  >
    <use :href="'#' + name" />
  </svg>
</template>
