<script setup lang="ts">
import { t } from '@/i18n'
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { isInfiniteNode, nextCost } from '@/stores/transcend'
import { fmt } from '@/lib/format'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import Icon from '@/components/ui/Icon.vue'
import { bulkLabel } from '@/composables/useBulkLabel'

const game = useGameStore()
const showConfirm = ref(false)

const previewGain = computed(() => game.previewTranscendGain())
const canTranscend = computed(() => game.canTranscend())

/** 买断节点（maxLevel=1）：引导期目标，购买一次封顶 */
const buyoutNodes = computed(() => game.transcend.tree.filter((n) => !isInfiniteNode(n)))
/** 无限节点（maxLevel>1）：负熵支出端永不枯竭的长期成长轴 */
const infiniteNodes = computed(() => game.transcend.tree.filter((n) => isInfiniteNode(n)))

/** 无限节点当前总加成文案（乘数型 = value^level） */
function totalBonusLabel(node: (typeof game.transcend.tree)[number]): string {
  const eff = node.effects[0]
  if (!eff) return ''
  const total = Math.pow(eff.value, node.level)
  const pct = Math.round((total - 1) * 100)
  return node.level > 0 ? t('prestige.currentBonus', { pct: pct }) : t('prestige.inactive')
}

function tryPurchase(nodeId: string, steps = 1) {
  game.transcend.purchaseNodeSteps(nodeId, steps)
}

// v0.86 无限天赋批量购买段位（默认 ×1 与既有行为一致；买断节点不显示切换器）
const infBulk = ref(1)

// v0.94 批量预览：×N>1 时展示实际可买级数与预计总花费（与实扣一致）
const infPreviews = computed(() => {
  const map: Record<string, { count: number; cost: number }> = {}
  if (infBulk.value > 1) {
    for (const node of infiniteNodes.value) {
      map[node.id] = game.transcend.previewPurchaseSteps(node.id, infBulk.value)
    }
  }
  return map
})

/**
 * 无限节点按钮文案：段位 >1 时按当前负熵实际可买级数显示（随资源动态变化），
 * 一级都买不起时退回原文案（按钮同时处于禁用态，成本行另有「可买 0 级」）。
 */
function purchaseLabel(node: { id: string; level: number }): string {
  return bulkLabel(
    node.level === 0 ? t('prestige.buy') : t('prestige.upgrade'),
    infPreviews.value[node.id]?.count ?? 0
  )
}

function tryTranscend() {
  if (!canTranscend.value) return
  showConfirm.value = true
}
function confirmTranscend() {
  game.doTranscend()
  showConfirm.value = false
}
function cancelTranscend() {
  showConfirm.value = false
}
</script>

<template>
  <div class="prestige-view">
    <h2 class="page-title font-display">{{ t('prestige.title') }}</h2>
    <p class="page-sub">{{ t('prestige.subtitle') }}</p>

    <!-- 负熵面板 -->
    <div class="neg-panel">
      <div>
        <div class="neg-label">{{ t('prestige.negEntropyLabel') }}</div>
        <div class="neg-value font-display">{{ fmt(game.transcend.negativeEntropy) }}</div>
      </div>
      <div>
        <div class="preview-label">{{ t('prestige.available') }}</div>
        <div class="preview-value font-mono" :class="{ ready: canTranscend }">
          +{{ fmt(previewGain) }}
        </div>
      </div>
    </div>

    <!-- 转生按钮 -->
    <button class="btn-transcend" :disabled="!canTranscend" @click="tryTranscend">
      <Icon name="i-nav-prestige" size="md" />
      {{ t('prestige.doTranscend') }}
    </button>
    <p v-if="!canTranscend" class="req-hint">
      {{ t('prestige.needLead') }} 300,000 {{ t('prestige.needTail') }}
    </p>
    <p v-else class="ready-hint">{{ t('prestige.ready') }}</p>

    <!-- 转生树 -->
    <div>
      <h3 class="section-title">{{ t('prestige.treeTitle') }}</h3>
      <div class="tree-grid">
        <div
          v-for="node in buyoutNodes"
          :key="node.id"
          class="tree-node"
          :class="{
            purchased: node.level > 0,
            affordable: node.level === 0 && game.transcend.negativeEntropy.gte(node.cost),
          }"
        >
          <div class="node-head">
            <span class="node-name">{{ node.name }}</span>
            <span class="node-cost font-mono"
              >{{ fmt(node.cost) }} {{ t('resources.negEntropy') }}</span
            >
          </div>
          <p class="node-desc">{{ node.desc }}</p>
          <div class="node-effects">
            <span v-for="(e, i) in node.effects" :key="i" class="node-eff">{{ e.label }}</span>
          </div>
          <button
            v-if="node.level === 0"
            class="btn-accent sm block"
            style="--accent: var(--color-amber)"
            :disabled="game.transcend.negativeEntropy.lt(node.cost)"
            @click="tryPurchase(node.id)"
          >
            {{ t('prestige.buy') }}
          </button>
          <div v-else class="purchased-tag">{{ t('prestige.active') }}</div>
        </div>
      </div>

      <h3 class="section-title infinite-title">
        {{ t('prestige.infiniteTitle') }}
        <span class="infinite-badge" aria-hidden="true">∞</span>
        <span class="bulk-toggle" role="group" :aria-label="t('prestige.bulkAria')">
          <button
            v-for="s in [1, 10, 100]"
            :key="s"
            class="seg-btn"
            :class="{ active: infBulk === s }"
            :aria-pressed="infBulk === s"
            @click="infBulk = s"
          >
            ×{{ s }}
          </button>
        </span>
      </h3>
      <p class="infinite-sub">{{ t('prestige.infiniteDesc') }}</p>
      <div class="tree-grid">
        <div
          v-for="node in infiniteNodes"
          :key="node.id"
          class="tree-node infinite-node"
          :class="{
            purchased: node.level > 0,
            affordable: game.transcend.negativeEntropy.gte(nextCost(node)),
          }"
        >
          <div class="node-head">
            <span class="node-name">
              {{ node.name }}
              <span class="node-level font-mono">Lv.{{ node.level }}</span>
            </span>
            <span class="node-cost font-mono"
              ><template v-if="infBulk > 1 && infPreviews[node.id].count > 0"
                >{{ t('common.canBuy') }} {{ infPreviews[node.id].count }}
                {{ t('common.unitLevel') }} · {{ t('common.totalLead') }}
                {{ fmt(infPreviews[node.id].cost) }} {{ t('resources.negEntropy') }}</template
              ><template v-else-if="infBulk > 1"
                >{{ t('common.canBuy') }} 0 {{ t('common.unitLevel') }}</template
              ><template v-else
                >{{ fmt(nextCost(node)) }} {{ t('resources.negEntropy') }}</template
              ></span
            >
          </div>
          <p class="node-desc">{{ node.desc }}</p>
          <div class="node-effects">
            <span v-for="(e, i) in node.effects" :key="i" class="node-eff">{{ e.label }}</span>
            <span class="node-eff node-eff-total">{{ totalBonusLabel(node) }}</span>
          </div>
          <button
            class="btn-accent sm block"
            style="--accent: var(--color-amber)"
            :disabled="game.transcend.negativeEntropy.lt(nextCost(node))"
            @click="tryPurchase(node.id, infBulk)"
          >
            {{ purchaseLabel(node) }}
          </button>
        </div>
      </div>
    </div>

    <!-- 转生确认弹窗 -->
    <ConfirmModal
      :model-value="showConfirm"
      :aria-label="t('prestige.confirmTitle')"
      :confirm-text="t('prestige.confirm')"
      accent="var(--color-amber)"
      @cancel="cancelTranscend"
      @confirm="confirmTranscend"
    >
      <h2 class="confirm-title font-display">{{ t('prestige.confirmTitle') }}</h2>
      <div class="warning-box">
        <p>⚠️ {{ t('prestige.resetTitle') }}</p>
        <ul>
          <li>{{ t('prestige.resetResources') }}</li>
          <li>{{ t('prestige.resetBuildings') }}</li>
          <li>{{ t('prestige.resetTech') }}</li>
          <li>{{ t('prestige.resetArmy') }}</li>
          <li>{{ t('prestige.resetStrongholds') }}</li>
          <li>{{ t('prestige.resetExplore') }}</li>
        </ul>
        <p>✅ {{ t('prestige.keepTitle') }}</p>
        <ul>
          <li>{{ t('prestige.keepRelics') }}</li>
          <li>{{ t('prestige.keepNegEntropy') }}</li>
          <li>{{ t('prestige.keepTranscends') }}</li>
          <li>{{ t('prestige.keepAchievements') }}</li>
        </ul>
      </div>
      <p class="gain-preview">
        {{ t('prestige.gain') }} +{{ fmt(previewGain) }} {{ t('resources.negEntropy') }}
      </p>
    </ConfirmModal>
  </div>
</template>

<style scoped>
.prestige-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: screenIn 0.4s var(--ease-out);
}
.page-title {
  color: var(--color-amber);
}

.neg-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-amber);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.neg-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
}
.neg-value {
  font-size: var(--text-2xl);
  font-weight: 900;
  color: var(--color-amber);
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-amber) 30%, transparent);
}
.preview-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  text-align: right;
}
.preview-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-t-tertiary);
}
.preview-value.ready {
  color: var(--color-quantum);
}

.btn-transcend {
  width: 100%;
  padding: var(--space-4);
  background: linear-gradient(135deg, var(--color-amber), #ff8c00);
  color: var(--color-void);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--text-base);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: all 0.15s var(--ease-out);
}
.btn-transcend:hover:not(:disabled) {
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-amber) 30%, transparent);
}
.btn-transcend:active:not(:disabled) {
  transform: scale(0.97);
}
.btn-transcend:disabled {
  background: var(--color-elevated);
  color: var(--color-t-tertiary);
  cursor: not-allowed;
  opacity: 0.5;
}
.req-hint {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  text-align: center;
}
.ready-hint {
  font-size: var(--text-xs);
  color: var(--color-quantum);
  text-align: center;
}

.tree-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.tree-node {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.tree-node.purchased {
  border-color: var(--color-quantum);
}
.tree-node.affordable {
  border-color: var(--color-amber);
}
.node-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}
.node-name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.node-cost {
  font-size: var(--text-xs);
  color: var(--color-amber);
}
.node-desc {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-bottom: var(--space-2);
}
.node-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}
.node-eff {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: var(--color-elevated);
  border-radius: var(--radius-xs);
}
.purchased-tag {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-quantum);
}

/* —— 无限天赋区（v0.56）—— */
.infinite-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
/* v0.86 无限天赋批量购买段位切换器（区标题行内） */
.bulk-toggle {
  margin-left: auto;
  --accent: var(--color-amber);
}
.infinite-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  height: 1.4em;
  padding: 0 0.3em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-amber) 14%, transparent);
  border: 1px solid var(--color-amber);
  color: var(--color-amber);
  font-size: var(--text-xs);
  line-height: 1;
}
.infinite-sub {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
  margin-bottom: var(--space-2);
}
.infinite-node {
  border-left: 3px solid var(--color-amber);
}
.infinite-node.purchased {
  border-left-color: var(--color-quantum);
}
.node-level {
  margin-left: var(--space-2);
  padding: 0 var(--space-1);
  border-radius: var(--radius-xs);
  background: var(--color-elevated);
  color: var(--color-quantum);
  font-size: var(--text-xs);
}
.node-eff-total {
  background: color-mix(in srgb, var(--color-quantum) 12%, transparent);
  color: var(--color-quantum);
}

/* 弹窗本体挂载在 ModalOverlay 内部，本视图 scoped 规则须经 :deep() 穿透（v0.82） */
:deep(.modal) {
  border-color: var(--color-amber);
}
/* 标题基样式为全局 .confirm-title，此处仅保留本视图差异（v1.02） */
.confirm-title {
  font-size: var(--text-lg);
  color: var(--color-amber);
  margin-bottom: var(--space-3);
}
.warning-box {
  background: color-mix(in srgb, var(--color-alert) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-alert) 20%, transparent);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--text-xs);
  margin-bottom: var(--space-3);
}
.warning-box ul {
  margin: var(--space-1) 0 var(--space-2) var(--space-4);
  color: var(--color-t-secondary);
}
.warning-box p {
  color: var(--color-t-primary);
}
.gain-preview {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-quantum);
  margin-bottom: var(--space-3);
}
</style>
