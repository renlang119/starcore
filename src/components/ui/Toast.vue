<script setup lang="ts">
import type { ToastApi } from '@/composables/useToast'

/**
 * Toast — 轻提示浮层（v0.73 全局收敛）
 *
 * 样式走全局 styles/toast.css（.toast），各视图不再各自 scoped 复制。
 * Transition name="toast" 与拆分前一致。
 */
defineProps<{ toast: ToastApi }>()
</script>

<template>
  <Transition name="toast">
    <div v-if="toast.msg.value" class="toast" role="status" aria-live="polite">
      {{ toast.msg.value }}
    </div>
  </Transition>
</template>
