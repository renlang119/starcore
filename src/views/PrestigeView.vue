<script setup lang="ts">
import { computed, ref } from 'vue'
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

function tryPurchase(nodeId: string) {
  game.transcend.purchaseNode(nodeId)
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
  const copied = await copyToClipboard(code)
  if (copied) {
    importMsg.show('已导出并复制到剪贴板', 5000)
    showExportCode.value = false
  } else {
    // 回退：把存档码填入只读文本域供手动复制
    exportCodeDisplay.value = code
    showExportCode.value = true
    importMsg.show('复制失败，请长按下方文本框手动复制', 5000)
  }
}
async function doImport() {
  if (!importCode.value) {
    importMsg.show('请先粘贴存档代码', 3000)
    return
  }
  const result = await game.doImport(importCode.value)
  importMsg.show(
    result.success ? '导入成功，页面将刷新' : result.message || '导入失败：存档无效',
    3000
  )
  if (result.success) setTimeout(() => location.reload(), 1500)
}
async function manualSave() {
  try {
    await game.save()
    saveMsg.show('已保存', 3000)
  } catch {
    saveMsg.show('保存失败', 3000)
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
</script>

<template>
  <div class="prestige-view">
    <h2 class="page-title font-display">奇点重启</h2>
    <p class="page-sub">重置大部分进度，获得负熵永久强化</p>

    <!-- 负熵面板 -->
    <div class="neg-panel">
      <div class="neg-display">
        <div class="neg-label">负熵（永久货币）</div>
        <div class="neg-value font-display">{{ fmt(negEntropy) }}</div>
      </div>
      <div class="neg-preview">
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
    <div class="tree-section">
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
            <span class="node-cost font-mono">{{ node.cost }} 负熵</span>
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
            <span class="node-cost font-mono">{{ nextCost(node) }} 负熵</span>
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
            @click="tryPurchase(node.id)"
          >
            {{ node.level === 0 ? '购买' : '升级' }}
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
          placeholder="导出存档码"
          @focus="($event.target as HTMLTextAreaElement).select()"
        ></textarea>
      </div>
      <div class="import-box">
        <textarea v-model="importCode" placeholder="粘贴存档代码…" rows="3"></textarea>
        <button class="btn-secondary sm" @click="doImport">导入存档</button>
      </div>
      <p v-if="importMsg.msg.value" class="import-msg">{{ importMsg.msg.value }}</p>
    </div>

    <!-- 转生确认弹窗 -->
    <ModalOverlay v-model="showConfirm" aria-label="确认奇点重启" @overlay-click="cancelTranscend">
      <h2 class="confirm-title font-display">确认奇点重启？</h2>
      <div class="warning-box">
        <p>⚠️ 将重置以下内容：</p>
        <ul>
          <li>所有资源（暗物质部分保留）</li>
          <li>所有建筑等级</li>
          <li>所有科技进度</li>
          <li>所有部队和编组</li>
          <li>所有探索进度</li>
        </ul>
        <p>✅ 保留以下内容：</p>
        <ul>
          <li>遗物与装备</li>
          <li>负熵与转生树</li>
          <li>转生次数</li>
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
      v-model="showResetConfirm"
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
  text-shadow: 0 0 16px rgba(255, 182, 39, 0.3);
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
  box-shadow: 0 0 20px rgba(255, 182, 39, 0.3);
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
.infinite-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  height: 1.4em;
  padding: 0 0.3em;
  border-radius: 999px;
  background: rgba(255, 182, 39, 0.14);
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
  background: rgba(46, 230, 160, 0.12);
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
.confirm-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-amber);
  text-align: center;
  margin-bottom: var(--space-3);
}
.warning-box {
  background: rgba(244, 63, 94, 0.06);
  border: 1px solid rgba(244, 63, 94, 0.2);
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
.confirm-actions {
  display: flex;
  gap: var(--space-2);
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
