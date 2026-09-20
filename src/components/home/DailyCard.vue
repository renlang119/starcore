<script setup lang="ts">
// DailyCard — 每日签到/周期挑战合并卡片（v0.62 玩法扩展方案 7）
// 签到自动进行（tick 驱动），卡片只展示状态与挑战领取入口
import { t } from '@/i18n'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { localDateStr } from '@/stores/daily'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const game = useGameStore()
const checkedInToday = computed(() => game.daily.lastCheckIn === localDateStr())
/** 连击在 7 天循环内的节点位置（1~7） */
const cycleDay = computed(() => ((game.daily.streak - 1) % 7) + 1)

/** 挑战显示名 */
const CHALLENGE_NAMES: Record<string, (n: number) => string> = {
  wk_battles: (n) => t('home.daily.ch.wkBattles', { n }),
  wk_explores: (n) => t('home.daily.ch.wkExplores', { n }),
  wk_researches: (n) => t('home.daily.ch.wkResearches', { n }),
  wk_upgrades: (n) => t('home.daily.ch.wkUpgrades', { n }),
  wk_transcends: (n) => t('home.daily.ch.wkTranscends', { n }),
}
function challengeName(c: { templateId: string; target: number }): string {
  return CHALLENGE_NAMES[c.templateId]?.(c.target) ?? c.templateId
}

const claimable = (c: (typeof game.daily.weekChallenges)[0]) => game.daily.claimable(c)

function claim(templateId: string) {
  game.claimChallenge(templateId)
}
</script>

<template>
  <div class="daily-card" data-testid="daily-card">
    <div class="daily-head">
      <h3 class="section-title">{{ t('home.daily.title') }} · {{ t('home.daily.challenges') }}</h3>
      <span class="checkin-badge" :class="{ done: checkedInToday }" data-testid="checkin-badge">
        {{
          checkedInToday
            ? t('home.daily.checkedIn', { streak: game.daily.streak })
            : t('home.daily.pendingAuto')
        }}
      </span>
    </div>

    <!-- 连击进度点：7 天循环，1/3/7 为奖励节点（金色） -->
    <div class="streak-dots" data-testid="streak-dots">
      <span
        v-for="i in 7"
        :key="i"
        class="dot"
        :class="{ lit: i <= cycleDay, bonus: [1, 3, 7].includes(i) }"
        :title="t('home.daily.dayTitle', { day: i })"
      ></span>
      <span class="streak-num font-mono" data-testid="streak-count"
        >{{ game.daily.streak }} {{ t('home.daily.streakUnit') }}</span
      >
    </div>

    <!-- 本周挑战 -->
    <div class="challenge-list" data-testid="challenge-list">
      <div
        v-for="c in game.daily.weekChallenges"
        :key="c.templateId"
        class="challenge-row"
        :class="{ done: claimable(c), claimed: c.claimed }"
        :data-testid="'challenge-' + c.templateId"
      >
        <div class="c-info">
          <span class="c-name">{{ challengeName(c) }}</span>
          <ProgressBar class="c-bar" fill-class="c-fill" :pct="game.daily.progressOf(c) * 100" />
          <span class="c-count font-mono"
            >{{ Math.min(game.daily.weeklyCounters[c.kind], c.target) }}/{{ c.target }}</span
          >
        </div>
        <button
          v-if="claimable(c)"
          class="btn-accent sm"
          style="--accent: var(--color-amber)"
          :data-testid="'claim-' + c.templateId"
          @click="claim(c.templateId)"
        >
          {{ t('home.daily.claim') }} +{{ c.rewardDark }} {{ t('resources.dark') }}
        </button>
        <span v-else-if="c.claimed" class="c-claimed">{{ t('home.daily.claimed') }}</span>
        <span v-else class="c-reward font-mono">+{{ c.rewardDark }} ◆</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.daily-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.daily-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.checkin-badge {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  white-space: nowrap;
}
.checkin-badge.done {
  color: var(--color-quantum);
}

.streak-dots {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--color-border-line);
}
.dot.lit {
  background: var(--color-quantum);
  border-color: var(--color-quantum);
}
.dot.bonus.lit {
  background: var(--color-amber);
  border-color: var(--color-amber);
}
.streak-num {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}

.challenge-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.challenge-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.challenge-row.done {
  background: color-mix(in srgb, var(--color-amber) 6%, transparent);
  border-radius: var(--radius-md);
}
.challenge-row.claimed {
  opacity: 0.5;
}
.c-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.c-name {
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.c-bar {
  flex: 1;
  min-width: 40px;
  --pb-track: var(--color-border-line);
  --pb-fill: var(--color-quantum);
  --pb-transition: none;
}
.c-count {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  flex-shrink: 0;
}
.c-reward {
  font-size: var(--text-xs);
  color: var(--color-amber);
  flex-shrink: 0;
}
.c-claimed {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  flex-shrink: 0;
}
</style>
