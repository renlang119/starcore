<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fallbackActive, resetFallback } from '@/lib/error-fallback'
import AppShell from '@/components/layout/AppShell.vue'

const game = useGameStore()
const loaded = ref(false)

/** 兜底屏标题：存档读取失败或运行期异常 */
const errorTitle = computed(() => (fallbackActive.value ? '星核运行异常' : '星核读取失败'))
/** 兜底屏提示文案：版本过新 / 存档损坏 / 读取失败 / 运行期异常四种口径 */
const errorHint = computed(() => {
  if (fallbackActive.value)
    return '游戏运行遇到异常。建议先刷新页面重试；若问题反复出现，可清除存档重开。'
  if (game.initError === 'too_new') return '存档来自更新版本的游戏，当前版本无法读取。'
  if (game.initError === 'corrupt')
    return '存档数据已损坏，无法读取。可先导出原始存档，再清除重开。'
  return '存档数据异常，读取失败。'
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
    exitMsg.value = '未找到可导出的原始存档数据。'
    return
  }
  try {
    downloadText(`starcore-corrupt-save-${Date.now()}.json`, raw, 'application/json')
    exitMsg.value = '已开始下载原始存档文件。'
  } catch {
    exitMsg.value = '导出失败，请刷新页面后重试。'
  }
}
/** 兜底屏出口（运行期异常）：导出当前存档码，供玩家刷新或清档前自行留存 */
async function exportSaveFile() {
  try {
    const code = await game.doExport()
    downloadText(`starcore-save-${Date.now()}.txt`, code, 'text/plain')
    exitMsg.value = '已开始下载存档文件。'
  } catch {
    exitMsg.value = '导出失败，请刷新页面后重试。'
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
    exitMsg.value = '清除存档失败，请刷新页面后重试。'
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
      导出原始存档
    </button>
    <button v-if="fallbackActive" class="btn btn-accent" @click="reloadPage">刷新页面</button>
    <button v-if="fallbackActive" class="btn btn-secondary" @click="exportSaveFile">
      导出存档
    </button>
    <button
      class="btn"
      :class="fallbackActive ? 'btn-secondary' : 'btn-accent'"
      :disabled="clearing"
      @click="clearAndRestart"
    >
      清除存档重开
    </button>
    <p v-if="exitMsg" class="error-msg">{{ exitMsg }}</p>
  </div>
  <AppShell v-else-if="loaded" />
  <div v-else class="loading-screen">
    <div class="loading-core"></div>
    <p>正在初始化星核…</p>
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
