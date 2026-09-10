<script setup lang="ts">
// SVG icon symbol 定义 — facade：统一渲染 7 个子组件
// 符号表由 AppShell 单点挂载（v0.77 收敛），各视图不再各自 import/挂载
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
