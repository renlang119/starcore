<script setup lang="ts">
// SVG icon symbol 定义 — facade：统一渲染 7 个子组件
// 拆分后 8 个 view 的 `import Icons` 与 `<Icons/>` 完全不变
import {
  IconsBase,
  IconsResource,
  IconsBuilding,
  IconsTech,
  IconsRelic,
  IconsStronghold,
  IconsUnit,
} from './icons'
</script>

<template>
  <IconsBase />
  <IconsResource />
  <IconsBuilding />
  <IconsTech />
  <IconsRelic />
  <IconsStronghold />
  <IconsUnit />
</template>
