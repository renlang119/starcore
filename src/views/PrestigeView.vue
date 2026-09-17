<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { isInfiniteNode, nextCost } from '@/stores/transcend'
import { fmt } from '@/lib/format'
import ModalOverlay from '@/components/ui/ModalOverlay.vue'
import { useToast } from '@/composables/useToast'

const game = useGameStore()
const showConfirm = ref(false)

const negEntropy = computed(() => game.transcend.negativeEntropy)
const previewGain = computed(() => game.previewTranscendGain())
const canTranscend = computed(() => game.canTranscend())

const tree = computed(() => game.transcend.tree)
/** 买断节点（maxLevel=1）：引导期目标，购买一次封顶 */
const buyoutNodes = computed(() => tree.value.filter((n) => !isInfiniteNode(n)))
/** 无限节点（maxLevel>1）：负熵支出端永不枯竭的长期成长轴 */
const infiniteNodes = computed(() => tree.value.filter((n) => isInfiniteNode(n)))

/** 无限节点当前总加成文案（乘数型 = value^level） */
function totalBonusLabel(node: (typeof tree.value)[number]): string {
  const eff = node.effects[0]
  if (!eff) return ''
  const total = Math.pow(eff.value, node.level)
  const pct = Math.round((total - 1) * 100)
  return node.level > 0 ? `当前 +${pct}%` : '尚未激活'
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
  const base = node.level === 0 ? '购买' : '升级'
  if (infBulk.value <= 1) return base
  const count = infPreviews.value[node.id]?.count ?? 0
  return count > 0 ? `${base} ×${count}` : base
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

// 存档管理
const importCode = ref('')
const importMsg = useToast()
const saveMsg = useToast()
const showExportCode = ref(false)
const exportCodeDisplay = ref('')
const showResetConfirm = ref(false)
const showImportConfirm = ref(false)
/** 导入成功后的刷新定时器句柄（卸载时清理，v0.84） */
let reloadTimer: ReturnType<typeof setTimeout> | null = null

/** 剪贴板复制（带回退，兼容非安全上下文 http） */
async function copyToClipboard(text: string): Promise<boolean> {
  // 1. 优先 navigator.clipboard（需安全上下文 https/localhost）
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* 继续 fallback */
    }
  }
  // 2. 回退 execCommand('copy')（非安全上下文也可用）
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    ta.setAttribute('readonly', '')
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return true
  } catch {
    /* 继续 fallback */
  }
  // 3. 两种方式均失败
  return false
}

async function doExport() {
  const code = await game.doExport()
  // 存档码始终展示在只读文本域（v0.86.2）：http 等非安全上下文下剪贴板
  // API 可能静默失败，玩家永远有手动复制兜底，不依赖复制是否成功
  exportCodeDisplay.value = code
  const copied = await copyToClipboard(code)
  if (copied) {
    importMsg.show('已导出并复制到剪贴板，存档码同时显示在下方', 5000)
    showExportCode.value = true
  } else {
    showExportCode.value = true
    importMsg.show('自动复制不可用，请长按下方文本框手动复制', 5000)
  }
}
function tryImport() {
  if (!importCode.value) {
    importMsg.show('请先粘贴存档代码', 3000)
    return
  }
  showImportConfirm.value = true
}
async function confirmImport() {
  showImportConfirm.value = false
  const result = await game.doImport(importCode.value)
  importMsg.show(
    result.success ? '导入成功，页面将刷新' : result.message || '导入失败：存档无效',
    3000
  )
  if (result.success) {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => location.reload(), 1500)
  }
}
function cancelImport() {
  showImportConfirm.value = false
}
async function manualSave() {
  const ok = await game.save()
  if (ok) {
    saveMsg.show('已保存', 3000)
  } else {
    saveMsg.show('保存失败：存储空间不足', 3000)
  }
}
function tryHardReset() {
  showResetConfirm.value = true
}
async function confirmHardReset() {
  showResetConfirm.value = false
  await game.hardReset()
  location.reload()
}
function cancelHardReset() {
  showResetConfirm.value = false
}

onUnmounted(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
})
</script>

<template>
  <div class="prestige-view">
    <h2 class="page-title font-display">奇点重启</h2>
    <p class="page-sub">重置大部分进度，获得负熵永久强化</p>

    <!-- 负熵面板 -->
    <div class="neg-panel">
      <div>
        <div class="neg-label">负熵（永久货币）</div>
        <div class="neg-value font-display">{{ fmt(negEntropy) }}</div>
      </div>
      <div>
        <div class="preview-label">本次转生可获得</div>
        <div class="preview-value font-mono" :class="{ ready: canTranscend }">
          +{{ fmt(previewGain) }}
        </div>
      </div>
    </div>

    <!-- 转生按钮 -->
    <button class="btn-transcend" :disabled="!canTranscend" @click="tryTranscend">
      <svg style="width: var(--icon-md); height: var(--icon-md)" aria-hidden="true">
        <use href="#i-nav-prestige" />
      </svg>
      执行奇点重启
    </button>
    <p v-if="!canTranscend" class="req-hint">需达到 300,000 总能量产出才能转生</p>
    <p v-else class="ready-hint">已满足转生条件！</p>

    <!-- 转生树 -->
    <div>
      <h3 class="section-title">转生天赋树</h3>
      <div class="tree-grid">
        <div
          v-for="node in buyoutNodes"
          :key="node.id"
          class="tree-node"
          :class="{
            purchased: node.level > 0,
            affordable: node.level === 0 && negEntropy.gte(node.cost),
          }"
        >
          <div class="node-head">
            <span class="node-name">{{ node.name }}</span>
            <span class="node-cost font-mono">{{ fmt(node.cost) }} 负熵</span>
          </div>
          <p class="node-desc">{{ node.desc }}</p>
          <div class="node-effects">
            <span v-for="(e, i) in node.effects" :key="i" class="node-eff">{{ e.label }}</span>
          </div>
          <button
            v-if="node.level === 0"
            class="btn-accent sm block"
            style="--accent: var(--color-amber)"
            :disabled="negEntropy.lt(node.cost)"
            @click="tryPurchase(node.id)"
          >
            购买
          </button>
          <div v-else class="purchased-tag">已激活</div>
        </div>
      </div>

      <h3 class="section-title infinite-title">
        无限天赋
        <span class="infinite-badge" aria-hidden="true">∞</span>
        <span class="bulk-toggle" role="group" aria-label="单次购买级数">
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
      <p class="infinite-sub">可重复购买，成本逐级递增，效果永久叠加</p>
      <div class="tree-grid">
        <div
          v-for="node in infiniteNodes"
          :key="node.id"
          class="tree-node infinite-node"
          :class="{
            purchased: node.level > 0,
            affordable: negEntropy.gte(nextCost(node)),
          }"
        >
          <div class="node-head">
            <span class="node-name">
              {{ node.name }}
              <span class="node-level font-mono">Lv.{{ node.level }}</span>
            </span>
            <span class="node-cost font-mono"
              ><template v-if="infBulk > 1 && infPreviews[node.id].count > 0"
                >可买 {{ infPreviews[node.id].count }} 级 · 共
                {{ fmt(infPreviews[node.id].cost) }} 负熵</template
              ><template v-else-if="infBulk > 1">可买 0 级</template
              ><template v-else>{{ fmt(nextCost(node)) }} 负熵</template></span
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
            :disabled="negEntropy.lt(nextCost(node))"
            @click="tryPurchase(node.id, infBulk)"
          >
            {{ purchaseLabel(node) }}
          </button>
        </div>
      </div>
    </div>

    <!-- 存档管理 -->
    <div class="save-section">
      <h3 class="section-title">存档管理</h3>
      <div class="save-actions">
        <button class="btn-secondary sm" @click="doExport">导出存档</button>
        <button class="btn-secondary sm" @click="manualSave">手动保存</button>
        <button class="btn-ghost sm" style="color: var(--color-alert)" @click="tryHardReset">
          清除存档
        </button>
      </div>
      <p v-if="saveMsg.msg.value" class="save-msg">{{ saveMsg.msg.value }}</p>
      <!-- 导出码回退显示（剪贴板不可用时） -->
      <div v-if="showExportCode" class="export-fallback">
        <textarea
          :value="exportCodeDisplay"
          readonly
          rows="4"
          aria-label="导出存档码"
          placeholder="导出存档码"
          @focus="($event.target as HTMLTextAreaElement).select()"
        ></textarea>
      </div>
      <div class="import-box">
        <textarea v-model="importCode" placeholder="粘贴存档代码…" rows="3"></textarea>
        <button class="btn-secondary sm" @click="tryImport">导入存档</button>
      </div>
      <p v-if="importMsg.msg.value" class="import-msg">{{ importMsg.msg.value }}</p>
    </div>

    <!-- 导入确认弹窗：导入为全量替换，破坏性操作二次确认 -->
    <ModalOverlay
      :model-value="showImportConfirm"
      aria-label="确认导入存档"
      @overlay-click="cancelImport"
    >
      <h2 class="confirm-title font-display" style="color: var(--color-alert)">确认导入存档？</h2>
      <div class="warning-box">
        <p>⚠️ 导入将<strong>完全替换</strong>当前存档，当前进度不可恢复。</p>
      </div>
      <div class="btn-group">
        <button class="btn-secondary" @click="cancelImport">取消</button>
        <button class="btn-accent" style="--accent: var(--color-alert)" @click="confirmImport">
          确认导入
        </button>
      </div>
    </ModalOverlay>

    <!-- 转生确认弹窗 -->
    <ModalOverlay
      :model-value="showConfirm"
      aria-label="确认奇点重启"
      @overlay-click="cancelTranscend"
    >
      <h2 class="confirm-title font-display">确认奇点重启？</h2>
      <div class="warning-box">
        <p>⚠️ 将重置以下内容：</p>
        <ul>
          <li>所有资源（暗物质部分保留）</li>
          <li>所有建筑等级</li>
          <li>所有科技进度</li>
          <li>所有部队和编组</li>
          <li>所有据点攻克记录与驻扎状态</li>
          <li>所有探索进度</li>
        </ul>
        <p>✅ 保留以下内容：</p>
        <ul>
          <li>遗物与装备</li>
          <li>负熵与转生树</li>
          <li>转生次数</li>
          <li>成就与终身计数</li>
        </ul>
      </div>
      <p class="gain-preview">获得 +{{ fmt(previewGain) }} 负熵</p>
      <div class="confirm-actions">
        <button class="btn-secondary" style="flex: 1" @click="cancelTranscend">取消</button>
        <button
          class="btn-accent"
          style="flex: 1; --accent: var(--color-amber)"
          @click="confirmTranscend"
        >
          确认重启
        </button>
      </div>
    </ModalOverlay>

    <!-- 清除存档确认弹窗 -->
    <ModalOverlay
      :model-value="showResetConfirm"
      aria-label="确认清除存档"
      @overlay-click="cancelHardReset"
    >
      <h2 class="confirm-title font-display" style="color: var(--color-alert)">确认清除存档？</h2>
      <div class="warning-box">
        <p>⚠️ 此操作将<strong>永久清除</strong>以下全部数据，不可恢复：</p>
        <ul>
          <li>所有资源、建筑、科技</li>
          <li>所有部队、据点、探索进度</li>
          <li>所有遗物、负熵、转生树</li>
          <li>转生次数</li>
        </ul>
        <p>游戏将回到全新开局状态。</p>
      </div>
      <div class="confirm-actions">
        <button class="btn-secondary" style="flex: 1" @click="cancelHardReset">取消</button>
        <button
          class="btn-accent"
          style="flex: 1; --accent: var(--color-alert)"
          @click="confirmHardReset"
        >
          确认清除
        </button>
      </div>
    </ModalOverlay>
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
  border-radius: 3px;
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
  border-radius: 3px;
  background: var(--color-elevated);
  color: var(--color-quantum);
  font-size: var(--text-xs);
}
.node-eff-total {
  background: color-mix(in srgb, var(--color-quantum) 12%, transparent);
  color: var(--color-quantum);
}

.save-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.save-actions {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.import-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.import-box textarea {
  background: var(--color-elevated);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-primary);
  resize: vertical;
}
.import-msg {
  font-size: var(--text-xs);
  color: var(--color-core);
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
.save-msg {
  font-size: var(--text-xs);
  color: var(--color-quantum);
  margin-top: calc(-1 * var(--space-1));
}
.export-fallback {
  margin-top: var(--space-1);
}
.export-fallback textarea {
  width: 100%;
  background: var(--color-elevated);
  border: 1px solid var(--color-amber);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-t-primary);
  resize: vertical;
  word-break: break-all;
}
</style>
