<script setup lang="ts">
/**
 * EmptyState — 页面空状态通用组件（体验增强设计规范 §3.2.1）
 *
 * 图标 + 主文案 + 提示文案 + 可选引导按钮，居中堆叠。
 * 样式复用全局 .empty-state 体系（style.css）。
 * action + to 同时传入时按钮路由跳转；仅 action 时发 action 事件。
 */
import { useRouter } from 'vue-router'

withDefaults(
  defineProps<{
    /** 图标 symbol id（i-nav-* / i-relic-* 等） */
    icon: string
    /** 主文案 */
    text: string
    /** 提示文案（弱化小字） */
    hint?: string
    /** 引导按钮文字（不传则不显示按钮） */
    action?: string
    /** 引导按钮跳转路径（action 存在时生效；不传则仅发事件） */
    to?: string
  }>(),
  {
    hint: '',
    action: '',
    to: '',
  }
)

const emit = defineEmits<{ action: [] }>()
const router = useRouter()

function onAction() {
  emit('action')
}
</script>

<template>
  <div class="empty-state">
    <svg class="empty-icon" style="width: 32px; height: 32px" aria-hidden="true">
      <use :href="'#' + icon" />
    </svg>
    <span class="empty-text">{{ text }}</span>
    <span v-if="hint" class="empty-hint">{{ hint }}</span>
    <button
      v-if="action"
      class="btn-secondary sm es-action"
      @click="to ? router.push(to) : onAction()"
    >
      {{ action }}
    </button>
  </div>
</template>

<style scoped>
.es-action {
  margin-top: var(--space-2);
}
</style>
