<script setup lang="ts">
/**
 * AchievementsView.vue — 成就/里程碑页（v0.57 玩法扩展方案 2）
 * 按类别分区展示 37 个成就：已解锁（时间戳+高亮）/进行中（进度条）/未达成
 */
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { fmt, fmtDate, fmtTime } from '@/lib/format'
import type { Decimal } from '@/lib/decimal'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import Icon from '@/components/ui/Icon.vue'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  groupByCategory,
  type AchievementDef,
  type AchievementMetric,
} from '@/data/achievements'

const game = useGameStore()
const ach = game.achievements

const groups = groupByCategory()

/** 阈值/当前值的展示格式化（按指标类型选择） */
function fmtMetricValue(metric: AchievementMetric, v: number): string {
  if (metric === 'playtime') return fmtTime(v)
  if (metric === 'energy' || metric === 'dark') return fmt(v)
  return String(Math.floor(v))
}

function progressPct(def: AchievementDef): number {
  return Math.min(100, ach.progressOf(def.metric, def.threshold) * 100)
}

function unlockedDate(def: AchievementDef): string {
  const ts = ach.unlocked[def.id]
  if (ts === undefined) return ''
  return fmtDate(ts)
}

/** 顶部汇总：已解锁成就的效果合并预览（连乘口径，与实际生效一致，v0.95） */
const bonusSummary = computed(() => {
  const toPct = (m: Decimal) => Math.round((m.toNumber() - 1) * 1000) / 10
  const prod = toPct(ach.getMult('production_mult', 'all'))
  const combat = toPct(ach.getMult('combat_mult', 'attack'))
  const explore = toPct(ach.getMult('explore_mult'))
  const offline = toPct(ach.getMult('offline_bonus'))
  const prestige = toPct(ach.getMult('prestige_mult'))
  const parts: string[] = []
  if (prod > 0) parts.push(`全产出 +${prod}%`)
  if (combat > 0) parts.push(`攻防 +${combat}%`)
  if (explore > 0) parts.push(`探索 +${explore}%`)
  if (offline > 0) parts.push(`离线 +${offline}%`)
  if (prestige > 0) parts.push(`负熵 +${prestige}%`)
  return parts.length > 0 ? parts.join(' · ') : '尚未获得加成'
})
</script>

<template>
  <div class="achievements-view">
    <h2 class="page-title font-display">成就殿堂</h2>
    <p class="page-sub">跨越轮回的里程碑，点亮永久加成</p>

    <!-- 汇总面板 -->
    <div class="summary-panel">
      <div class="summary-count">
        <span class="count-num font-display">{{ ach.unlockedCount }}</span>
        <span class="count-total font-mono">/ {{ ACHIEVEMENTS.length }}</span>
      </div>
      <div class="summary-bonus">
        <div class="bonus-label">已获得加成</div>
        <div class="bonus-value">{{ bonusSummary }}</div>
      </div>
    </div>

    <!-- 分类成就列表 -->
    <section v-for="[cat, defs] in groups" :key="cat" class="ach-section">
      <h3 class="section-title with-icon">
        <Icon class="cat-icon" :name="ACHIEVEMENT_CATEGORIES[cat].icon" />
        {{ ACHIEVEMENT_CATEGORIES[cat].label }}
      </h3>
      <div class="ach-grid">
        <div
          v-for="def in defs"
          :key="def.id"
          class="ach-card"
          :class="{ unlocked: ach.isUnlocked(def.id) }"
        >
          <div class="ach-icon-wrap">
            <Icon class="ach-icon" :name="ACHIEVEMENT_CATEGORIES[def.category].icon" />
            <Icon v-if="ach.isUnlocked(def.id)" class="ach-check" name="i-ui-check" />
          </div>
          <div class="ach-body">
            <div class="ach-head">
              <span class="ach-name">{{ def.name }}</span>
              <span class="ach-reward">{{ def.effects[0]?.label }}</span>
            </div>
            <p class="ach-desc">{{ def.desc }}</p>
            <!-- 已解锁：时间戳；进行中：进度条 -->
            <div v-if="ach.isUnlocked(def.id)" class="ach-done">
              ✓ 已解锁 · {{ unlockedDate(def) }}
            </div>
            <template v-else>
              <div class="ach-progress">
                <ProgressBar class="bar" fill-class="bar-fill" :pct="progressPct(def)" />
                <span class="progress-text font-mono">
                  {{ fmtMetricValue(def.metric, ach.metricValue(def.metric)) }} /
                  {{ fmtMetricValue(def.metric, def.threshold) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.achievements-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-title {
  color: var(--color-quantum);
}

.summary-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-quantum);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.summary-count {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.count-num {
  font-size: var(--text-2xl);
  font-weight: 900;
  color: var(--color-quantum);
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-quantum) 30%, transparent);
}
.count-total {
  font-size: var(--text-sm);
  color: var(--color-t-tertiary);
}
.summary-bonus {
  flex: 1;
  min-width: 200px;
  text-align: right;
}
.bonus-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.bonus-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-amber);
}

.ach-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.cat-icon {
  width: var(--icon-sm);
  height: var(--icon-sm);
  color: var(--color-t-secondary);
}
.ach-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ach-card {
  display: flex;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.ach-card.unlocked {
  border-color: var(--color-quantum);
}
.ach-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: var(--icon-lg);
  height: var(--icon-lg);
}
.ach-icon {
  width: var(--icon-lg);
  height: var(--icon-lg);
  color: var(--color-t-tertiary);
}
.ach-card.unlocked .ach-icon {
  color: var(--color-quantum);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-quantum) 40%, transparent));
}
.ach-check {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: var(--icon-sm);
  height: var(--icon-sm);
  color: var(--color-quantum);
  background: var(--color-surface);
  border-radius: 50%;
}
.ach-body {
  flex: 1;
  min-width: 0;
}
.ach-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ach-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.ach-reward {
  font-size: var(--text-xs);
  color: var(--color-amber);
  white-space: nowrap;
}
.ach-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin: var(--space-1) 0;
}
.ach-done {
  font-size: var(--text-xs);
  color: var(--color-quantum);
}
.ach-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.bar {
  flex: 1;
  --pb-fill: linear-gradient(90deg, var(--color-core), var(--color-quantum));
  --pb-transition: width 0.3s var(--ease-out);
}
.progress-text {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  white-space: nowrap;
}
</style>
