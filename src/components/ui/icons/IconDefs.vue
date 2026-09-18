<script setup lang="ts">
// IconDefs — 图标符号表的隐藏 svg/defs 外壳（v1.09 收敛）
// 经 Icons.vue facade 单点使用；7 个子 SFC 仅输出 symbol
</script>

<template>
  <svg style="display: none" aria-hidden="true">
    <defs>
      <slot />
    </defs>
  </svg>
</template>
