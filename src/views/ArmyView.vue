<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import OnboardingBubble from '@/components/ui/OnboardingBubble.vue'
import Toast from '@/components/ui/Toast.vue'
import BarracksPanel from '@/components/army/BarracksPanel.vue'
import FormationPanel from '@/components/army/FormationPanel.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { useToast } from '@/composables/useToast'

const game = useGameStore()
// 全局轻提示（v0.77：训练开始反馈）
const toast = useToast()
const activeTab = ref<'barracks' | 'formation'>('barracks')

// P3-3 onboarding
const { activeStep, dismiss, skipAll } = useOnboarding(['army-train'])

const totalPower = computed(() => game.military.totalPower(game.atkMult, game.defMult))

/** 兵营面板反馈 → 视图级轻提示（提示挂载在视图根部，随视图卸载清理） */
function showFeedback(msg: string) {
  toast.show(msg)
}
</script>

<template>
  <div class="army-view">
    <h2 class="page-title font-display">部队</h2>

    <!-- P3-3 onboarding -->
    <OnboardingBubble
      v-if="activeStep === 'army-train'"
      class="ob-army"
      title="部队"
      text="在兵营训练兵种，在编队页配置阵容后出征据点。"
      @dismiss="dismiss"
      @skip="skipAll"
    />

    <!-- 全军战力 -->
    <div class="power-bar">
      <div class="power-item">
        <span class="p-label">总攻击</span>
        <span class="p-value font-mono" style="color: var(--color-alert)">{{
          fmt(totalPower.atk)
        }}</span>
      </div>
      <div class="power-item">
        <span class="p-label">总防御</span>
        <span class="p-value font-mono" style="color: var(--color-core)">{{
          fmt(totalPower.def)
        }}</span>
      </div>
      <div class="power-item">
        <span class="p-label">总兵力</span>
        <span class="p-value font-mono" style="color: var(--color-quantum)">{{
          fmt(totalPower.hp)
        }}</span>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'barracks' }"
        @click="activeTab = 'barracks'"
      >
        兵营
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'formation' }"
        @click="activeTab = 'formation'"
      >
        编组
      </button>
    </div>

    <!-- 兵营：训练 -->
    <div v-if="activeTab === 'barracks'">
      <BarracksPanel @feedback="showFeedback" />
    </div>

    <!-- 编组 -->
    <div v-else>
      <FormationPanel />
    </div>

    <!-- 训练开始等轻提示（v0.77） -->
    <Toast :toast="toast" />
  </div>
</template>

<style scoped>
.army-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-title {
  color: var(--color-alert);
}

.power-bar {
  display: flex;
  gap: var(--space-2);
}
.power-item {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  text-align: center;
}
.p-label {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.p-value {
  font-size: var(--text-base);
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: var(--space-2);
}
.tab {
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-t-secondary);
}
.tab.active {
  background: var(--color-alert);
  color: var(--color-on-core);
  border-color: var(--color-alert);
}

/* P3-3 onboarding（变体类承载定位与层级，v0.97） */
.ob-army {
  position: relative;
  width: 100%;
  margin-bottom: var(--space-2);
  z-index: 60;
}
</style>
