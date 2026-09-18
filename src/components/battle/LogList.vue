<script setup lang="ts">
/**
 * LogList — 战斗日志行列表（v1.07 收敛自 BattleView 的页面日志区与结果弹窗战报）
 *
 * 容器类名（.log-list / .modal-log-list）由调用方经 class 透传并留在调用方
 * scoped 样式管辖；本组件自带日志行本体样式（.log-entry / .log-round）。
 */
import type { BattleLogEntry } from '@/stores/combat'

defineProps<{
  /** 战斗日志条目（来自 combat.resolveBattle） */
  entries: BattleLogEntry[]
}>()
</script>

<template>
  <div>
    <div
      v-for="(entry, i) in entries"
      :key="`${entry.round}-${i}`"
      class="log-entry"
      :class="entry.side"
    >
      <span class="log-round">R{{ entry.round }}</span>
      <span>{{ entry.msg }}</span>
    </div>
  </div>
</template>

<style scoped>
.log-entry {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--text-xs);
  border-bottom: 1px solid var(--color-border-line);
}
.log-entry.player {
  color: var(--color-core);
}
.log-entry.enemy {
  color: var(--color-alert);
}
.log-entry.system {
  color: var(--color-t-secondary);
}
.log-round {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  width: 32px;
  flex-shrink: 0;
}
</style>
