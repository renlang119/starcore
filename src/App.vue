<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import AppShell from '@/components/layout/AppShell.vue'

const game = useGameStore()
const loaded = ref(false)

/** 错误屏提示文案：版本过新 / 存档损坏 / 读取失败三种口径 */
const errorHint = computed(() => {
  if (game.initError === 'too_new') return '存档来自更新版本的游戏，当前版本无法读取。'
  if (game.initError === 'corrupt')
    return '存档数据已损坏，无法读取。可先导出原始存档，再清除重开。'
  return '存档数据异常，读取失败。'
})
/** 是否提供「导出原始存档」入口（仅损坏档：原始载荷还在时才有意义） */
const canExportRaw = computed(() => game.initError === 'corrupt' && !!game.corruptRaw)
/** 导出下载状态提示 */
const exportMsg = ref('')

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
/** 错误屏出口：导出损坏档的原始载荷（下载为 .json 文件，交玩家自行留存） */
function exportRawSave() {
  const raw = game.exportCorruptRaw()
  if (!raw) return
  try {
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `starcore-corrupt-save-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    exportMsg.value = '已开始下载原始存档文件。'
  } catch {
    exportMsg.value = '导出失败，请尝试复制页面数据或联系支持。'
  }
}
/** 错误屏出口：清除存档重开（手动确认，不自动清档） */
async function clearAndRestart() {
  await game.hardReset()
  loaded.value = true
  window.addEventListener('beforeunload', handleUnload)
}
</script>

<template>
  <AppShell v-if="loaded" />
  <div v-else-if="game.initError" class="loading-screen">
    <div class="error-mark">!</div>
    <p class="error-title">星核读取失败</p>
    <p class="error-hint">{{ errorHint }}</p>
    <button v-if="canExportRaw" class="btn btn-secondary" @click="exportRawSave">
      导出原始存档
    </button>
    <p v-if="exportMsg" class="export-msg">{{ exportMsg }}</p>
    <button class="btn btn-accent" @click="clearAndRestart">清除存档重开</button>
  </div>
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
.export-msg {
  max-width: 320px;
  text-align: center;
  color: var(--color-t-tertiary);
}
</style>
