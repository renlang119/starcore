<script setup lang="ts">
/**
 * ArchiveView.vue — 档案馆（v1.18 可玩内容扩展方案 1）
 *
 * 两大区块：
 * - 星图档案：34 节点按星层分组回读 story.ts 剧情文案（v1.08 迁出后
 *   首次接线）。已完成节点显示剧情，未完成显示锁定态不剧透；
 *   「已完成」并入当前轮探索进度（转生后随本轮重新点亮）
 * - 敌方档案：56 种敌方单位图鉴（按显示名聚合），交战即收录
 *   （胜负都算），未遇显示未知敌影占位
 */
import { t } from '@/i18n'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { ENEMY_KIND_BUCKETS } from '@/stores/archive'
import { EXPLORE_NODES, LAYER_INFO, type StarLayer } from '@/data/explore'
import { STRONGHOLDS, STRONGHOLD_TYPES } from '@/data/pve'
import { NODE_STORIES } from '@/data/story'
import Icon from '@/components/ui/Icon.vue'

/** 据点四类 id（与 pve.ts 内部 StrongholdType 同源） */
type StrongholdType = keyof typeof STRONGHOLD_TYPES

const game = useGameStore()
const archive = game.archive

// —— 星图档案：按层分组的节点行 ——
interface StoryRow {
  id: string
  name: string
  layer: StarLayer
  completed: boolean
  story: string
}
const layers = Object.keys(LAYER_INFO) as StarLayer[]

const storyRows = computed<StoryRow[]>(() =>
  EXPLORE_NODES.map((n) => ({
    id: n.id,
    name: n.name,
    layer: n.layer,
    completed: game.exploration.isCompleted(n.id),
    story: NODE_STORIES[n.id] ?? '',
  }))
)

const storyGroups = computed(() =>
  layers.map((layer) => ({
    layer,
    rows: storyRows.value.filter((r) => r.layer === layer),
    seen: storyRows.value.filter((r) => r.layer === layer && r.completed).length,
  }))
)

const seenStories = computed(() => storyRows.value.filter((r) => r.completed).length)

// —— 敌方档案：按据点类型分组的图鉴卡（按显示名聚合，完成 = 该名下任一条目已遭遇）——
interface EnemyCard {
  /** 聚合显示名（首个条目的名） */
  name: string
  type: StrongholdType
  seen: boolean
  /** 该名下全部条目是否都已遭遇（收集口径展示用） */
  complete: boolean
  /** 代表条目（首个已遭遇者；未遭遇时为该名首条） */
  representativeIndex: number
  representativeStronghold: string
}

const typeOrder: StrongholdType[] = ['raider', 'beast', 'ruin', 'silencer']

const enemyCards = computed<EnemyCard[]>(() => {
  // 名 → 聚合桶（同显示名多据点条目合并；聚合桶单一来源 = archive store 的
  // ENEMY_KIND_BUCKETS，v1.22 下沉后视图只补进度态）
  const byName = ENEMY_KIND_BUCKETS
  const cards: EnemyCard[] = []
  for (const [name, bucket] of byName) {
    const entries = bucket.entries.map((e) => ({
      key: e.key,
      seen: archive.hasSeen(e.key),
    }))
    const seenEntry = entries.find((e) => e.seen)
    cards.push({
      name,
      type: bucket.type,
      seen: entries.some((e) => e.seen),
      complete: entries.every((e) => e.seen),
      representativeIndex: Number((seenEntry ?? entries[0]).key.split('#')[1]),
      representativeStronghold: (seenEntry ?? entries[0]).key.split('#')[0],
    })
  }
  return cards
})

const enemyGroups = computed(() =>
  typeOrder.map((type) => ({
    type,
    cards: enemyCards.value.filter((c) => c.type === type),
    seen: enemyCards.value.filter((c) => c.type === type && c.seen).length,
  }))
)

const seenEnemies = computed(() => enemyCards.value.filter((c) => c.seen).length)

/** 图鉴卡展示属性取代表条目（首个已遭遇者） */
function cardEnemy(card: EnemyCard) {
  const s = STRONGHOLDS.find((x) => x.id === card.representativeStronghold)
  return s?.enemies[card.representativeIndex]
}
</script>

<template>
  <div class="archive-view">
    <h2 class="page-title font-display">{{ t('archive.title') }}</h2>
    <p class="page-sub">{{ t('archive.subtitle') }}</p>

    <!-- 星图档案 -->
    <section class="section">
      <h3 class="section-title with-icon">
        <Icon class="s-icon" name="i-nav-explore" />
        {{ t('archive.starMapSection') }}
        <span class="count-lead font-mono">
          {{ t('archive.loreCount', { seen: seenStories, total: storyRows.length }) }}
        </span>
      </h3>
      <p class="section-hint">{{ t('archive.starMapHint') }}</p>
      <div
        v-for="g in storyGroups"
        :key="g.layer"
        class="layer-group"
        data-testid="archive-story-group"
      >
        <h4 class="layer-name" :style="{ color: LAYER_INFO[g.layer].color }">
          {{ LAYER_INFO[g.layer].name }}
        </h4>
        <div class="story-list">
          <div
            v-for="row in g.rows"
            :key="row.id"
            class="story-card"
            :class="{ unlocked: row.completed }"
            data-testid="archive-story-card"
          >
            <div class="st-head">
              <span class="st-dot" :style="{ background: LAYER_INFO[row.layer].color }"></span>
              <span class="st-name">{{ row.completed ? row.name : '???' }}</span>
              <Icon v-if="row.completed" class="st-check" name="i-ui-check" size="sm" />
            </div>
            <p v-if="row.completed" class="st-story">{{ row.story }}</p>
            <p v-else class="st-story locked-text">{{ t('archive.storyUnread') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 敌方档案 -->
    <section class="section">
      <h3 class="section-title with-icon">
        <Icon class="s-icon" name="i-ui-sword" />
        {{ t('archive.bestiarySection') }}
        <span class="count-lead font-mono">
          {{ t('archive.enemyCount', { seen: seenEnemies, total: enemyCards.length }) }}
        </span>
      </h3>
      <p class="section-hint">{{ t('archive.bestiaryHint') }}</p>
      <div v-for="g in enemyGroups" :key="g.type" class="type-group">
        <h4 class="type-name" :style="{ color: STRONGHOLD_TYPES[g.type].color }">
          {{ STRONGHOLD_TYPES[g.type].name }}
        </h4>
        <div class="enemy-grid">
          <div
            v-for="card in g.cards"
            :key="card.name"
            class="enemy-card"
            :class="{ seen: card.seen }"
            data-testid="archive-enemy-card"
          >
            <div class="e-icon-wrap">
              <Icon class="e-icon" :name="STRONGHOLD_TYPES[card.type].icon" />
            </div>
            <div class="e-body">
              <div class="e-name">
                {{ card.seen ? card.name : t('archive.unknownEnemy') }}
              </div>
              <div v-if="card.seen && cardEnemy(card)" class="e-stats font-mono">
                <span>{{ t('common.statAttack') }} {{ cardEnemy(card)!.attack }}</span>
                <span>{{ t('common.statDefense') }} {{ cardEnemy(card)!.defense }}</span>
                <span>HP {{ cardEnemy(card)!.hp }}</span>
              </div>
              <div v-else class="e-stats locked-text">{{ t('archive.unknownEnemyDesc') }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.archive-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-title {
  color: var(--color-quantum);
}
.page-sub {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.s-icon {
  width: var(--icon-sm);
  height: var(--icon-sm);
  color: var(--color-t-secondary);
}
.count-lead {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  font-weight: 400;
}
.section-hint {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
}

/* —— 星图档案 —— */
.layer-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.layer-name {
  font-size: var(--text-sm);
  font-weight: 700;
}
.story-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.story-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.story-card.unlocked {
  border-color: var(--color-quantum);
}
.st-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}
.st-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}
.st-name {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: 600;
}
.story-card:not(.unlocked) .st-name {
  color: var(--color-locked);
}
.st-check {
  color: var(--color-quantum);
}
.st-story {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.6;
}
.locked-text {
  color: var(--color-locked);
}

/* —— 敌方档案 —— */
.type-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.type-name {
  font-size: var(--text-sm);
  font-weight: 700;
}
.enemy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-2);
}
.enemy-card {
  display: flex;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.enemy-card.seen {
  border-color: var(--color-quantum);
}
.e-icon-wrap {
  flex-shrink: 0;
  width: var(--icon-lg);
  height: var(--icon-lg);
}
.e-icon {
  width: var(--icon-lg);
  height: var(--icon-lg);
  color: var(--color-t-tertiary);
}
.enemy-card.seen .e-icon {
  color: var(--color-quantum);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-quantum) 40%, transparent));
}
.e-body {
  flex: 1;
  min-width: 0;
}
.e-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.enemy-card:not(.seen) .e-name {
  color: var(--color-locked);
}
.e-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-top: var(--space-1);
}
</style>
