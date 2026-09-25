<script setup lang="ts">
// EncounterCard — 随机遭遇事件卡（v1.26 可玩内容扩展方案 8）
// 挂起态显示事件与两选项按钮；结算/过期后随 store 状态消失。
// 结算回执由 AppShell 统一 watch lastResolution 呈现（全局单实例 toast），
// 本组件只调 game.resolveEncounter 落地发放。
import { t } from '@/i18n'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const enc = computed(() => game.encounters.pendingEvent)
const title = computed(() => (enc.value ? `${t('ui.encounter.title')} · ${enc.value.name}` : ''))

function choose(choice: 'A' | 'B') {
  game.resolveEncounter(choice)
}
</script>

<template>
  <div v-if="enc" class="enc-card" data-testid="encounter-card">
    <div class="enc-head">
      <h3 class="section-title">{{ title }}</h3>
    </div>
    <p class="enc-desc">{{ enc.desc }}</p>
    <div class="enc-opts">
      <button
        class="btn-accent sm enc-opt"
        style="--accent: var(--color-quantum)"
        data-testid="encounter-opt-A"
        @click="choose('A')"
      >
        {{ enc.optA.label }}
      </button>
      <button
        class="btn-accent sm enc-opt"
        style="--accent: var(--color-amber)"
        data-testid="encounter-opt-B"
        @click="choose('B')"
      >
        {{ enc.optB.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.enc-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.enc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.enc-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin: 0;
}
.enc-opts {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.enc-opt {
  flex: 1;
  min-width: 120px;
}
</style>
