<script setup lang="ts">
/**
 * EmptyState — 页面空状态通用组件（体验增强设计规范 §3.2.1）
 *
 * 图标 + 主文案 + 提示文案 + 可选引导按钮，居中堆叠。
 * 样式复用全局 .empty-state 体系（utilities.css）。
 * 引导按钮为纯路由跳转：action 与 to 同时传入才渲染（无 to 即无按钮，杜绝死按钮）。
 */
import { useRouter } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'

withDefaults(
  defineProps<{
    /** 图标 symbol id（i-nav-* / i-relic-* 等） */
    icon: string
    /** 主文案 */
    text: string
    /** 提示文案（弱化小字） */
    hint?: string
    /** 引导按钮文字（须与 to 同时传入才显示按钮） */
    action?: string
    /** 引导按钮跳转路径 */
    to?: string
  }>(),
  {
    hint: '',
    action: '',
    to: '',
  }
)

const router = useRouter()
</script>

<template>
  <div class="empty-state">
    <Icon class="empty-icon" :name="icon" style="width: 32px; height: 32px" />
    <span class="empty-text">{{ text }}</span>
    <span v-if="hint" class="empty-hint">{{ hint }}</span>
    <button v-if="action && to" class="btn-secondary sm es-action" @click="router.push(to)">
      {{ action }}
    </button>
  </div>
</template>

<style scoped>
.es-action {
  margin-top: var(--space-2);
}
</style>
