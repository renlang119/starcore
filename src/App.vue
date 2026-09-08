<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import AppShell from '@/components/layout/AppShell.vue'

const game = useGameStore()
const loaded = ref(false)

/** 错误屏提示文案：版本过新 / 读取失败两种口径 */
const errorHint = computed(() =>
  game.initError === 'too_new'
    ? '存档来自更新版本的游戏，当前版本无法读取。'
    : '存档数据异常，读取失败。'
)

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
</style>
