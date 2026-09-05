<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import AppShell from '@/components/layout/AppShell.vue'

const game = useGameStore()
const loaded = ref(false)

onMounted(async () => {
  await game.init()
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
</script>

<template>
  <AppShell v-if="loaded" />
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
</style>
