<script setup lang="ts">
import { t } from '@/i18n'
import ModalOverlay from './ModalOverlay.vue'

/**
 * ConfirmModal — 确认弹窗共用骨架（v1.07 收敛自部队批量/转生三弹窗/挂机驻扎
 * 五处同构弹窗）
 *
 * 标题与说明由默认插槽承载（槽内容在调用方作用域编译，各视图 scoped 样式链
 * 保持原样；弹窗内容被 ModalOverlay 搬进内层 .modal 的既有约束不额外引入）；
 * 本组件收敛 ModalOverlay 包裹与取消/确认按钮组两部分。
 */
withDefaults(
  defineProps<{
    modelValue: boolean
    /** 读屏标签（各弹窗语义各自保留；与 ModalOverlay 同模式可选，运行时由 aria-label 映射） */
    ariaLabel?: string
    /** 确认按钮文案 */
    confirmText: string
    /** 取消按钮文案 */
    cancelText?: string
    /** 确认按钮色调（--accent 注入） */
    accent?: string
    /** 按钮等宽拉伸；false 时按钮按内容宽度（导入确认弹窗口径） */
    stretch?: boolean
    /** stretch 时确认按钮的 flex 权重（挂机驻扎为 2） */
    confirmFlex?: number
    /** 按钮组容器类名（导入确认沿用原容器形态） */
    actionsClass?: string
    /** ModalOverlay 附加类（如 garrison-confirm-modal） */
    modalClass?: string
  }>(),
  {
    cancelText: t('common.cancel'),
    accent: 'var(--color-alert)',
    stretch: true,
    confirmFlex: 1,
    actionsClass: 'confirm-actions',
    ariaLabel: '',
    modalClass: '',
  }
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ModalOverlay
    :model-value="modelValue"
    :modal-class="modalClass"
    :aria-label="ariaLabel"
    @overlay-click="emit('cancel')"
  >
    <slot />
    <div :class="actionsClass">
      <button
        class="btn-secondary"
        :style="stretch ? { flex: 1 } : undefined"
        @click="emit('cancel')"
      >
        {{ cancelText }}
      </button>
      <button
        class="btn-accent"
        :style="stretch ? { flex: confirmFlex, '--accent': accent } : { '--accent': accent }"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </div>
  </ModalOverlay>
</template>
