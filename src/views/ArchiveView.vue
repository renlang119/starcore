<script setup lang="ts">
/**
 * ArchiveView.vue：档案馆（v1.18 可玩内容扩展方案 1）
 *
 * 四大区块：
 * - 星图档案：34 节点按星层分组回读 story.ts 剧情文案（v1.08 迁出后
 *   首次接线）。已完成节点显示剧情，未完成显示锁定态不剧透；
 *   「已完成」并入当前轮探索进度（转生后随本轮重新点亮）
 * - 七门：星臂尽头七扇巨门的观察留档（七门 · 回望），完成银河之
 *   门探索节点（当前轮）后解锁；解锁判读实时计算无持久化，转生
 *   后随本轮重新上锁（与星图档案同口径）。前六门为静默门，第七
 *   门磨痕门为仍在应答的门
 * - 回响：门后回响见闻（门后回响·终局后日谈），全宇宙探索完毕
 *   （当前轮 34/34）后解锁；解锁判读实时计算无持久化，转生后随
 *   本轮重新上锁（与星图档案同口径）
 * - 敌方档案：56 种敌方单位图鉴（按显示名聚合），交战即收录
 *   （胜负都算），未遇显示未知敌影占位；异星巨兽卡已收录态带
 *   生态注（迁徙 / 食性 / 栖地，v1.73 异星巨兽生态志，随收录显示）
 */
import { t } from '@/i18n'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { ENEMY_KIND_BUCKETS } from '@/data/pve'
import { EXPLORE_NODES, LAYER_INFO, type StarLayer } from '@/data/explore'
import { STRONGHOLDS, STRONGHOLD_TYPES } from '@/data/pve'
import { NODE_STORIES } from '@/data/story'
import { GATE_DOORS } from '@/data/gate'
import {
  IMPERIAL_ENTRY_COUNT,
  IMPERIAL_FINAL_ENTRY_COUNT,
  IMPERIAL_FINAL_SECTION,
  IMPERIAL_SECTIONS,
  IMPERIAL_TOTAL_ENTRY_COUNT,
} from '@/data/imperial'
import { ECHO_ENTRIES, ECHO_SEGMENTS } from '@/data/echo'
import { getBestiaryNoteForEntries, type BestiaryNote } from '@/data/bestiary'
import Icon from '@/components/ui/Icon.vue'

/** 据点四类 id（与 pve.ts 内部 StrongholdType 同源） */
type StrongholdType = keyof typeof STRONGHOLD_TYPES

const game = useGameStore()
const archive = game.archive

// 星图档案：按层分组的节点行
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

// 七门：解锁 = 完成银河之门探索节点（当前轮；越过应答门扉后的回望
// 视角，判读即算，空门表按未解锁处理，转生后随本轮重新上锁）
const gateUnlocked = computed(
  () => GATE_DOORS.length > 0 && game.exploration.isCompleted('node_galaxy_gate')
)

// 帝庭档案：解锁 = 完成银盘枢纽探索节点（当前轮；贡道走到进贡终点
// 后的观察视角，判读即算，空节表按未解锁处理，转生后随本轮重新
// 上锁，与七门及回响的解锁口径错开）
const imperialUnlocked = computed(
  () => IMPERIAL_SECTIONS.length > 0 && game.exploration.isCompleted('node_galaxy_hub')
)

// 炉前节（v1.81）：解锁 = 曾接管全部 6 座贡道据点（按曾接管集判读，
// 巡检失守不回收档案；与五节观察留档的分组解锁错开）
const imperialFinalUnlocked = computed(() => game.imperial.everCompleted.size >= 6)
// 分组计数：五节常开，炉前节随解锁计入
const imperialSeenCount = computed(
  () => IMPERIAL_ENTRY_COUNT + (imperialFinalUnlocked.value ? IMPERIAL_FINAL_ENTRY_COUNT : 0)
)

// 回响：解锁 = 当前轮全宇宙探索完毕（与星图档案、首页贺词同口径逐
// 节点判读，空节点表按未解锁处理，转生后随本轮重新上锁）
const echoUnlocked = computed(
  () =>
    EXPLORE_NODES.length > 0 &&
    EXPLORE_NODES.every((n) => game.exploration.isCompleted(n.id)) &&
    ECHO_ENTRIES.length > 0
)

// 敌方档案：按据点类型分组的图鉴卡（按显示名聚合，完成 = 该名下任一条目已遭遇），
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
  /** 生态注（仅异星巨兽部分物种配注；代表键语言无关，显示名运行时取） */
  note?: BestiaryNote
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
      note: getBestiaryNoteForEntries(bucket.entries.map((e) => e.key)),
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
  <div class="archive-view screen-enter">
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
              <span class="st-name">{{
                row.completed ? row.name : t('archive.storyLockedName')
              }}</span>
              <Icon v-if="row.completed" class="st-check" name="i-ui-check" size="sm" />
            </div>
            <p v-if="row.completed" class="st-story">{{ row.story }}</p>
            <p v-else class="st-story locked-text">{{ t('archive.storyUnread') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 七门（星臂尽头巨门观察留档，完成银河之门后解锁） -->
    <section class="section" data-testid="archive-gate-group">
      <h3 class="section-title with-icon">
        <Icon class="s-icon" name="i-relic-explore" />
        {{ t('archive.gateSection') }}
        <span v-if="gateUnlocked" class="count-lead font-mono">
          {{ t('archive.gateCount', { seen: GATE_DOORS.length, total: GATE_DOORS.length }) }}
        </span>
      </h3>
      <p class="section-hint">{{ t('archive.gateHint') }}</p>
      <p v-if="!gateUnlocked" class="gate-locked locked-text" data-testid="archive-gate-locked">
        {{ t('archive.gateLocked') }}
      </p>
      <template v-else>
        <div v-for="door in GATE_DOORS" :key="door.id" class="gate-door">
          <h4 class="gate-door-name">{{ door.name }}</h4>
          <div class="gate-grid">
            <article
              v-for="entry in door.entries"
              :key="entry.id"
              class="gate-card"
              data-testid="archive-gate-card"
            >
              <h5 class="gate-name">{{ entry.name }}</h5>
              <p class="gate-text">{{ entry.text }}</p>
              <p class="gate-note">{{ entry.note }}</p>
            </article>
          </div>
        </div>
      </template>
    </section>

    <!-- 帝庭档案（贡道核验仪卫裁决炉音观察留档，完成银盘枢纽后解锁） -->
    <section class="section" data-testid="archive-imperial-group">
      <h3 class="section-title with-icon">
        <Icon class="s-icon" name="i-tech-prestige" />
        {{ t('archive.imperialSection') }}
        <span v-if="imperialUnlocked" class="count-lead font-mono">
          {{
            t('archive.imperialCount', {
              seen: imperialSeenCount,
              total: IMPERIAL_TOTAL_ENTRY_COUNT,
            })
          }}
        </span>
      </h3>
      <p class="section-hint">{{ t('archive.imperialHint') }}</p>
      <p
        v-if="!imperialUnlocked"
        class="gate-locked locked-text"
        data-testid="archive-imperial-locked"
      >
        {{ t('archive.imperialLocked') }}
      </p>
      <template v-else>
        <div v-for="sec in IMPERIAL_SECTIONS" :key="sec.id" class="gate-door">
          <h4 class="gate-door-name">{{ sec.name }}</h4>
          <div class="gate-grid">
            <article
              v-for="entry in sec.entries"
              :key="entry.id"
              class="gate-card"
              data-testid="archive-imperial-card"
            >
              <h5 class="gate-name">{{ entry.name }}</h5>
              <p class="gate-text">{{ entry.text }}</p>
              <p class="gate-note">{{ entry.note }}</p>
            </article>
          </div>
        </div>
        <!-- 炉前节（v1.81）：曾全接管后解锁的亲见留档，随解锁计入分组计数 -->
        <div class="gate-door">
          <h4 class="gate-door-name">{{ IMPERIAL_FINAL_SECTION.name }}</h4>
          <p
            v-if="!imperialFinalUnlocked"
            class="gate-locked locked-text"
            data-testid="archive-imperial-final-locked"
          >
            {{ t('archive.imperialFinalLocked') }}
          </p>
          <div v-else class="gate-grid">
            <article
              v-for="entry in IMPERIAL_FINAL_SECTION.entries"
              :key="entry.id"
              class="gate-card"
              data-testid="archive-imperial-final-card"
            >
              <h5 class="gate-name">{{ entry.name }}</h5>
              <p class="gate-text">{{ entry.text }}</p>
              <p class="gate-note">{{ entry.note }}</p>
            </article>
          </div>
        </div>
      </template>
    </section>

    <!-- 回响（门后回响见闻，全宇宙探索完毕后解锁） -->
    <section class="section" data-testid="archive-echo-group">
      <h3 class="section-title with-icon">
        <Icon class="s-icon" name="i-relic-silence" />
        {{ t('archive.echoSection') }}
        <span v-if="echoUnlocked" class="count-lead font-mono">
          {{ t('archive.echoCount', { seen: ECHO_ENTRIES.length, total: ECHO_ENTRIES.length }) }}
        </span>
      </h3>
      <p class="section-hint">{{ t('archive.echoHint') }}</p>
      <p v-if="!echoUnlocked" class="echo-locked locked-text" data-testid="archive-echo-locked">
        {{ t('archive.echoLocked') }}
      </p>
      <template v-else>
        <div v-for="seg in ECHO_SEGMENTS" :key="seg.id" class="echo-segment">
          <h4 class="echo-seg-name">{{ seg.name }}</h4>
          <div class="echo-grid">
            <article
              v-for="e in ECHO_ENTRIES.slice(seg.start, seg.end)"
              :key="e.id"
              class="echo-card"
              data-testid="archive-echo-card"
            >
              <h5 class="echo-name font-display">{{ e.name }}</h5>
              <p class="echo-text">{{ e.text }}</p>
              <p class="echo-note font-mono">{{ e.note }}</p>
            </article>
          </div>
        </div>
      </template>
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
              <div v-if="card.seen && card.note" class="e-note" data-testid="archive-beast-note">
                <p>{{ card.note.mig }}</p>
                <p>{{ card.note.feed }}</p>
                <p>{{ card.note.hab }}</p>
              </div>
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

/* 星图档案 */
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
/* 桌面端宽屏：双列网格，利用横向空间（v1.37） */
@media (min-width: 1024px) {
  .story-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* 单卡分组跨列（v1.60）：孤卡跨双列，避免右列留黑；卡内行宽限 68ch */
  .story-list > .story-card:only-child {
    grid-column: span 2;
  }
  .story-list > .story-card:only-child .st-story {
    max-width: 68ch;
  }
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
  --c: currentColor;
  box-shadow: var(--glow-1);
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

/* 七门 */
.gate-locked {
  font-size: var(--text-sm);
  padding: var(--space-3) 0;
}
.gate-door {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.gate-door-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-layer-void);
}
.gate-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
/* 桌面端宽屏：双列网格（沿星图档案 v1.37 模式） */
@media (min-width: 1024px) {
  .gate-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.gate-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.gate-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-layer-void);
}
.gate-text {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.6;
  margin-top: var(--space-1);
}
.gate-note {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-top: var(--space-1);
}

/* 回响 */
.echo-locked {
  font-size: var(--text-sm);
  padding: var(--space-3) 0;
}
.echo-segment {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.echo-seg-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-layer-void);
}
.echo-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
/* 桌面端宽屏：双列网格（沿星图档案 v1.37 模式） */
@media (min-width: 1024px) {
  .echo-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.echo-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.echo-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-layer-void);
}
.echo-text {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.6;
  margin-top: var(--space-1);
}
.echo-note {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-top: var(--space-1);
}

/* 敌方档案 */
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
/* 生态注区：仅已收录异星巨兽卡出现；三行允许折行，两端一致 */
.e-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border-line);
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  line-height: 1.5;
}
</style>
