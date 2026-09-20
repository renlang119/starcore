<script setup lang="ts">
/**
 * SavePanel.vue — 存档管理面板（导出 / 手动保存 / 导入 / 清除存档）。
 *
 * 从 PrestigeView 拆出：按钮组、导出码回退显示、导入框与两处二次确认
 * 弹窗。文案、类名与交互保持不变；剪贴板复制带回退以兼容非安全上下文。
 */
import { t } from '@/i18n'
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useToast } from '@/composables/useToast'
import { useTimeout } from '@/composables/useTimeout'

const game = useGameStore()

// 存档管理
const importCode = ref('')
const importMsg = useToast()
const saveMsg = useToast()
const showExportCode = ref(false)
const exportCodeDisplay = ref('')
const showResetConfirm = ref(false)
const showImportConfirm = ref(false)
/** 导入成功后的刷新定时器（重触发先清旧、卸载清理由 useTimeout 承载） */
const reloadTimer = useTimeout()

/** 剪贴板复制（带回退，兼容非安全上下文 http） */
async function copyToClipboard(text: string): Promise<boolean> {
  // 1. 优先 navigator.clipboard（需安全上下文 https/localhost）
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* 继续 fallback */
    }
  }
  // 2. 回退 execCommand('copy')（非安全上下文也可用）
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    ta.setAttribute('readonly', '')
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return true
  } catch {
    /* 继续 fallback */
  }
  // 3. 两种方式均失败
  return false
}

async function doExport() {
  const code = await game.doExport()
  // 存档码始终展示在只读文本域（v0.86.2）：http 等非安全上下文下剪贴板
  // API 可能静默失败，玩家永远有手动复制兜底，不依赖复制是否成功
  exportCodeDisplay.value = code
  const copied = await copyToClipboard(code)
  if (copied) {
    importMsg.show(t('save.exportCopied'), 5000)
    showExportCode.value = true
  } else {
    showExportCode.value = true
    importMsg.show(t('save.copyUnavailable'), 5000)
  }
}
function tryImport() {
  if (!importCode.value) {
    importMsg.show(t('save.needPaste'), 3000)
    return
  }
  showImportConfirm.value = true
}
async function confirmImport() {
  showImportConfirm.value = false
  const result = await game.doImport(importCode.value)
  importMsg.show(
    result.success ? t('save.importOk') : result.message || t('save.importInvalid'),
    3000
  )
  if (result.success) {
    reloadTimer.set(() => location.reload(), 1500)
  }
}
function cancelImport() {
  showImportConfirm.value = false
}
async function manualSave() {
  const ok = await game.save()
  if (ok) {
    saveMsg.show(t('save.saved'), 3000)
  } else {
    saveMsg.show(t('save.saveFailed'), 3000)
  }
}
function tryHardReset() {
  showResetConfirm.value = true
}
async function confirmHardReset() {
  showResetConfirm.value = false
  await game.hardReset()
  location.reload()
}
function cancelHardReset() {
  showResetConfirm.value = false
}
</script>

<template>
  <!-- 存档管理 -->
  <div class="save-section">
    <h3 class="section-title">{{ t('save.panelTitle') }}</h3>
    <p class="save-meta">{{ game.player.name }} · {{ t('save.localTitle') }}</p>
    <div class="save-actions">
      <button class="btn-secondary sm" @click="doExport">{{ t('save.export') }}</button>
      <button class="btn-secondary sm" @click="manualSave">{{ t('save.manualSave') }}</button>
      <button class="btn-ghost sm" style="color: var(--color-alert)" @click="tryHardReset">
        {{ t('save.clear') }}
      </button>
    </div>
    <p v-if="saveMsg.msg.value" class="save-msg">{{ saveMsg.msg.value }}</p>
    <!-- 导出码回退显示（剪贴板不可用时） -->
    <div v-if="showExportCode" class="export-fallback">
      <textarea
        :value="exportCodeDisplay"
        readonly
        rows="4"
        :aria-label="t('save.exportCode')"
        :placeholder="t('save.exportCode')"
        @focus="($event.target as HTMLTextAreaElement).select()"
      ></textarea>
    </div>
    <div class="import-box">
      <textarea v-model="importCode" :placeholder="t('save.importPlaceholder')" rows="3"></textarea>
      <button class="btn-secondary sm" @click="tryImport">{{ t('save.import') }}</button>
    </div>
    <p v-if="importMsg.msg.value" class="import-msg">{{ importMsg.msg.value }}</p>
  </div>

  <!-- 导入确认弹窗：导入为全量替换，破坏性操作二次确认 -->
  <ConfirmModal
    :model-value="showImportConfirm"
    :aria-label="t('save.importConfirmTitle')"
    :confirm-text="t('save.importConfirm')"
    :stretch="false"
    actions-class="btn-group"
    @cancel="cancelImport"
    @confirm="confirmImport"
  >
    <h2 class="confirm-title font-display" style="color: var(--color-alert)">
      {{ t('save.importConfirmTitle') }}？
    </h2>
    <div class="warning-box">
      <p>
        ⚠️ {{ t('save.importWarnLead') }}<strong>{{ t('save.importWarnStrong') }}</strong
        >{{ t('save.importWarnTail') }}。
      </p>
    </div>
  </ConfirmModal>

  <!-- 清除存档确认弹窗 -->
  <ConfirmModal
    :model-value="showResetConfirm"
    :aria-label="t('save.clearConfirmTitle')"
    :confirm-text="t('save.clearConfirm')"
    @cancel="cancelHardReset"
    @confirm="confirmHardReset"
  >
    <h2 class="confirm-title font-display" style="color: var(--color-alert)">
      {{ t('save.clearConfirmTitle') }}？
    </h2>
    <div class="warning-box">
      <p>
        ⚠️ {{ t('save.clearWarnLead') }}<strong>{{ t('save.clearWarnStrong') }}</strong
        >{{ t('save.clearWarnTail') }}：
      </p>
      <ul>
        <li>{{ t('save.clearListA') }}</li>
        <li>{{ t('save.clearListB') }}</li>
        <li>{{ t('save.clearListC') }}</li>
        <li>{{ t('save.clearListD') }}</li>
      </ul>
      <p>{{ t('save.clearNote') }}。</p>
    </div>
  </ConfirmModal>
</template>

<style scoped>
.save-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.save-actions {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.import-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.import-box textarea {
  background: var(--color-elevated);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-primary);
  resize: vertical;
}
.import-msg {
  font-size: var(--text-xs);
  color: var(--color-core);
}

/* 弹窗本体挂载在 ModalOverlay 内部，本组件 scoped 规则须经 :deep() 穿透（v0.82） */
:deep(.modal) {
  border-color: var(--color-amber);
}
/* 标题基样式为全局 .confirm-title，此处仅保留本组件差异（v1.02） */
.confirm-title {
  font-size: var(--text-lg);
  color: var(--color-amber);
  margin-bottom: var(--space-3);
}
.warning-box {
  background: color-mix(in srgb, var(--color-alert) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-alert) 20%, transparent);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--text-xs);
  margin-bottom: var(--space-3);
}
.warning-box ul {
  margin: var(--space-1) 0 var(--space-2) var(--space-4);
  color: var(--color-t-secondary);
}
.warning-box p {
  color: var(--color-t-primary);
}
.save-meta {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-bottom: var(--space-2);
}
.save-msg {
  font-size: var(--text-xs);
  color: var(--color-quantum);
  margin-top: calc(-1 * var(--space-1));
}
.export-fallback {
  margin-top: var(--space-1);
}
.export-fallback textarea {
  width: 100%;
  background: var(--color-elevated);
  border: 1px solid var(--color-amber);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-primary);
  resize: vertical;
  word-break: break-all;
}
</style>
