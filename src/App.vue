<script setup lang="ts">
import { t } from '@/i18n'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fallbackActive, resetFallback } from '@/lib/error-fallback'
import AppShell from '@/components/layout/AppShell.vue'

const game = useGameStore()
const loaded = ref(false)

/** 兜底屏标题：存档读取失败或运行期异常 */
const errorTitle = computed(() =>
  fallbackActive.value ? t('app.errorTitle') : t('app.readFailTitle')
)
/** 兜底屏提示文案：版本过新 / 存档损坏 / 读取失败 / 运行期异常四种口径 */
const errorHint = computed(() => {
  if (fallbackActive.value) return t('app.crashHint')
  if (game.initError === 'too_new') return t('app.saveTooNew')
  if (game.initError === 'corrupt') return t('app.saveCorrupt')
  return t('app.saveBroken')
})
/** 是否提供「导出原始存档」入口（仅损坏档：原始载荷还在时才有意义） */
const canExportRaw = computed(() => game.initError === 'corrupt' && !!game.corruptRaw)
/** 出口动作的结果提示（导出与清除共用一处展示） */
const exitMsg = ref('')
/** 清除请求进行中标志（防连点重入） */
const clearing = ref(false)

onMounted(async () => {
  await game.init()
  // 错误态：由错误屏接管，不挂 beforeunload（避免空状态覆盖原始存档）
  if (game.initError) return
  loaded.value = true
  // 页面关闭前保存
  window.addEventListener('beforeunload', handleUnload)
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', handleUnload)
})
function handleUnload() {
  // 同步写入 localStorage 备份，确保 beforeunload 来得及完成
  game.saveSync()
}
/**
 * 触发一次文本下载（兜底屏出口共用）
 *
 * 链接挂入文档后点击、对象地址延迟回收：部分浏览器要求链接在文档内
 * 才执行下载，点击后立即回收会让下载在真正开始前失效。
 */
function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
/** 兜底屏出口：导出损坏档的原始载荷（下载为 .json 文件，交玩家自行留存） */
function exportRawSave() {
  const raw = game.exportCorruptRaw()
  if (!raw) {
    exitMsg.value = t('save.rawNone')
    return
  }
  try {
    downloadText(`starcore-corrupt-save-${Date.now()}.json`, raw, 'application/json')
    exitMsg.value = t('save.rawDownloaded')
  } catch {
    exitMsg.value = t('save.exportFailed')
  }
}
/** 兜底屏出口（运行期异常）：导出当前存档码，供玩家刷新或清档前自行留存 */
async function exportSaveFile() {
  try {
    const code = await game.doExport()
    downloadText(`starcore-save-${Date.now()}.txt`, code, 'text/plain')
    exitMsg.value = t('save.saveDownloaded')
  } catch {
    exitMsg.value = t('save.exportFailed')
  }
}
/** 兜底屏出口（运行期异常）：整页刷新重试 */
function reloadPage() {
  location.reload()
}
/** 兜底屏出口：清除存档重开（手动点击执行，不自动清档） */
async function clearAndRestart() {
  if (clearing.value) return
  clearing.value = true
  exitMsg.value = ''
  try {
    await game.hardReset()
    resetFallback()
    loaded.value = true
    window.addEventListener('beforeunload', handleUnload)
  } catch {
    exitMsg.value = t('save.clearFailed')
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <div v-if="fallbackActive || game.initError" class="loading-screen">
    <div class="error-mark">!</div>
    <p class="error-title">{{ errorTitle }}</p>
    <p class="error-hint">{{ errorHint }}</p>
    <button v-if="canExportRaw" class="btn btn-secondary" @click="exportRawSave">
      {{ t('save.exportRaw') }}
    </button>
    <button v-if="fallbackActive" class="btn btn-accent" @click="reloadPage">
      {{ t('app.reload') }}
    </button>
    <button v-if="fallbackActive" class="btn btn-secondary" @click="exportSaveFile">
      {{ t('save.export') }}
    </button>
    <button
      class="btn"
      :class="fallbackActive ? 'btn-secondary' : 'btn-accent'"
      :disabled="clearing"
      @click="clearAndRestart"
    >
      {{ t('app.clearSave') }}
    </button>
    <p v-if="exitMsg" class="error-msg">{{ exitMsg }}</p>
  </div>
  <AppShell v-else-if="loaded" />
  <div v-else class="loading-screen">
    <div class="loading-core"></div>
    <p>{{ t('app.initializing') }}…</p>
  </div>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  color: var(--color-t-secondary);
  font-size: var(--text-sm);
  background: var(--color-void);
}
.loading-core {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--color-core) 0%,
    var(--color-core-deep) 70%,
    transparent 100%
  );
  animation: corePulse 2s ease-in-out infinite;
}
.error-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 2px solid var(--color-alert);
  border-radius: 50%;
  color: var(--color-alert);
  font-size: var(--text-2xl);
  font-weight: 700;
}
.error-title {
  color: var(--color-t-primary);
  font-size: var(--text-lg);
}
.error-hint {
  max-width: 320px;
  text-align: center;
}
.error-msg {
  max-width: 320px;
  text-align: center;
  color: var(--color-t-tertiary);
}
</style>
