<!-- src/components/ui/ModalOverlay.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps<{
  /** 是否显示弹窗 */
  modelValue: boolean
  /** 无障碍标签 */
  ariaLabel?: string
  /** 弹窗额外 class（如 victory/defeat） */
  modalClass?: string | Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'overlayClick'): void
}>()

const modalRef = ref<HTMLElement | null>(null)
const trapActive = computed(() => props.modelValue)
// Escape 与「点击遮罩」同语义：交由使用点处理关闭/取消（v0.77）
useFocusTrap(modalRef, trapActive, { onEscape: () => emit('overlayClick') })

function onOverlayClick() {
  emit('overlayClick')
}
</script>

<template>
  <transition name="fade">
    <div v-if="modelValue" class="modal-overlay active" @click.self="onOverlayClick">
      <div
        ref="modalRef"
        class="modal"
        :class="modalClass"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel"
      >
        <slot />
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal {
  width: 100%;
  max-width: 360px;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-glow);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--elevation-3); /* P2-6 */
  animation: modalIn 0.25s var(--ease-out);
}
</style>
