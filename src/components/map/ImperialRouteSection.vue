<script setup lang="ts">
import { t } from '@/i18n'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { resourceRows } from '@/lib/resource-rows'
import { fmt, fmtTime } from '@/lib/format'
import type { ResourceType } from '@/data/buildings'
import {
  IMPERIAL_CLAIM_CAP_SECONDS,
  IMPERIAL_AUDIT_STRICT_BONUS,
  IMPERIAL_STRONGHOLDS,
  imperialTributeRate,
  type ImperialStrongholdDef,
} from '@/data/imperial-strongholds'
import { EXPLORE_NODES } from '@/data/explore'
import {
  FORGE_INPUT_RESOURCES,
  FORGE_STABILITY_MAX,
  FORGE_TRIBUTE_COST,
  pickForgeResource,
  type ForgeInputResource,
} from '@/data/imperial-strongholds'

const game = useGameStore()
const router = useRouter()

/** 当前时刻：随 game 每秒 tick 时间戳联动（lastTickTime 读取建立响应式依赖） */
const now = computed(() => game.lastTickTime)

/** 贡道区解锁：银盘枢纽（与档案馆帝庭档案分组同门槛） */
const routeUnlocked = computed(() => game.exploration.isCompleted('node_galaxy_hub'))

/** 已接管计数（区头 n/6） */
const heldCount = computed(() => game.imperial.completed.size)

/** 节点 id → 显示名（锁定原因展示用） */
const NODE_NAME = new Map(EXPLORE_NODES.map((n) => [n.id, n.name]))

/** 单座据点行的派生视图（状态 / 速率 / 整备成本一次算齐） */
interface ImperialRow {
  def: ImperialStrongholdDef
  captured: boolean
  /** 本周巡检目标（已接管座 + 待迎战/逾期态，卡头亮标） */
  isAuditTarget: boolean
  suspended: boolean
  tier: number
  rate: number
  locked: boolean
  requireLabel: string
  upgradeRows: { id: string; name: string; amount: string }[]
  upgradeAffordable: boolean
  maxTier: boolean
}

const rows = computed<ImperialRow[]>(() => {
  const best = game.combat.expeditionBest
  const capturedCount = game.imperial.completed.size
  const out: ImperialRow[] = []
  for (const def of IMPERIAL_STRONGHOLDS) {
    const nodeOk = game.exploration.isCompleted(def.requires)
    const capturedOk = capturedCount >= (def.requiresCaptured ?? 0)
    const captured = game.imperial.completed.has(def.id)
    const tier = game.imperial.tierOf(def.id)
    const cost = captured ? game.imperial.upgradeCost(def.id, best) : null
    const a = game.imperial.audit
    const isAuditTarget =
      captured && !!a && a.targetId === def.id && (a.status === 'pending' || a.status === 'overdue')
    out.push({
      def,
      captured,
      isAuditTarget,
      suspended: game.imperial.isSuspended(def.id, now.value),
      tier,
      // 未接管座按 1 级预估速率展示（接管决策参考）；已接管座取实时
      // 速率（含整备加成与停摆归零）
      rate: captured
        ? game.imperial.rateOf(def.id, best, now.value)
        : imperialTributeRate(def, best, 1),
      locked: !(routeUnlocked.value && nodeOk && capturedOk),
      requireLabel: !nodeOk
        ? t('map.imperialRequireNode', { node: NODE_NAME.get(def.requires) ?? def.requires })
        : t('map.imperialRequireCaptured', { n: def.requiresCaptured ?? 0 }),
      upgradeRows: cost
        ? resourceRows(cost, game.resources.allMeta).map((r) => ({
            id: r.id,
            name: r.name,
            amount: r.amount,
          }))
        : [],
      upgradeAffordable: cost ? game.resources.canAfford(cost) : false,
      maxTier: tier >= 3,
    })
  }
  return out
})

/** 贡赋池：资源行 + 距上限占比（取占比最高的资源驱动进度条） */
const poolBundle = computed(() => game.imperial.pool(game.combat.expeditionBest, now.value))
const poolRows = computed(() =>
  resourceRows(poolBundle.value, game.resources.allMeta).map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
  }))
)
const poolFill = computed(() => {
  const rates = game.imperial.tributeTotals(game.combat.expeditionBest, now.value)
  let fill = 0
  for (const [res, v] of Object.entries(poolBundle.value)) {
    const rate = rates[res as ResourceType] ?? 0
    if (rate > 0 && v) fill = Math.max(fill, v / (rate * IMPERIAL_CLAIM_CAP_SECONDS))
  }
  return Math.min(1, fill)
})

/** 池临满（v1.82 QoL：任一资源占比 ≥90%，领取按钮警示态 + 提示文案） */
const poolNearFull = computed(() => poolFill.value >= 0.9)

/** 巡检视图状态：pending / overdue 可迎战可打点，其余只读 */
interface AuditView {
  key: 'pending' | 'overdue' | 'passed' | 'paid' | 'failed'
  text: string
  fightable: boolean
  /** 窗口临近关闭（v1.82 QoL：pending 剩余不足 12 小时，卡面警示态） */
  urgent: boolean
}

/** 巡检临期阈值（秒）：剩余不足此值的 pending 巡检进入警示态 */
const AUDIT_URGENT_SECONDS = 12 * 3600

const auditView = computed<AuditView | null>(() => {
  const a = game.imperial.audit
  if (!a) return null
  const target = IMPERIAL_STRONGHOLDS.find((s) => s.id === a.targetId)
  const name = target?.name ?? a.targetId
  switch (a.status) {
    case 'pending':
      return {
        key: 'pending',
        text: t('map.imperialAuditPending', {
          name,
          time: fmtTime(Math.max(0, (a.deadline - now.value) / 1000)),
        }),
        fightable: true,
        urgent: (a.deadline - now.value) / 1000 < AUDIT_URGENT_SECONDS,
      }
    case 'overdue':
      return {
        key: 'overdue',
        text: t('map.imperialAuditOverdue', { name }),
        fightable: true,
        urgent: true,
      }
    case 'passed':
      return a.paid
        ? { key: 'paid', text: t('map.imperialAuditPaid'), fightable: false, urgent: false }
        : {
            key: 'passed',
            text: t('map.imperialAuditPassed', {
              pct: game.imperial.bonus === IMPERIAL_AUDIT_STRICT_BONUS ? 30 : 10,
            }),
            fightable: false,
            urgent: false,
          }
    case 'failed':
      return {
        key: 'failed',
        text: t('map.imperialAuditFailed', { name }),
        fightable: false,
        urgent: false,
      }
  }
  // status 为穷尽联合，此行仅为 lint 显式兜底（vue/return-in-computed-property）
  return null
})

/** 打点成本（仅待迎战/逾期时展示） */
const payCostRows = computed(() => {
  if (!auditView.value?.fightable) return []
  const cost = game.imperial.auditPayCost(game.combat.expeditionBest, now.value)
  if (!cost) return []
  return resourceRows(cost, game.resources.allMeta).map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
  }))
})

const payAffordable = computed(() => {
  if (!auditView.value?.fightable) return false
  const cost = game.imperial.auditPayCost(game.combat.expeditionBest, now.value)
  return cost ? game.resources.canAfford(cost) : false
})

function claimTribute() {
  game.claimImperialTribute(now.value)
}
function upgradeStronghold(id: string) {
  game.upgradeImperialStronghold(id)
}
function payAudit() {
  game.payImperialAudit()
}
function toBattle(id: string) {
  router.push(`/battle/${id}`)
}
// —— 炉域（v1.83）：贡道尽头的倾贡入口 ——
const forgeUnlocked = computed(() => game.imperial.forgeUnlocked)
const forgeEntered = computed(() => game.imperial.forge !== null)
/** 当前稳定度（随 tick 补算显示，不落盘） */
const forgeStabilityNow = computed(() => game.imperial.forgeStability(now.value))
const forgePicked = computed(() => pickForgeResource(game.daily.currentWeek))
const forgePickedName = computed(() => resourceName(forgePicked.value))
/** 四选一投入按钮行：点名标记 + 验资 */
const forgeTributeRows = computed(() =>
  FORGE_INPUT_RESOURCES.map((r) => ({
    id: r,
    name: resourceName(r),
    cost: FORGE_TRIBUTE_COST[r],
    picked: r === forgePicked.value,
    affordable: game.resources.getAmount(r).gte(FORGE_TRIBUTE_COST[r]),
  }))
)
/** 当日剩余倾贡次数（0 时四按钮全部禁用） */
const forgeRemaining = computed(() => game.imperial.forgeRemainingToday(now.value))
function enterForge(): void {
  game.enterForge()
}
function giveTribute(r: ForgeInputResource): void {
  game.tributeForge(r)
}

/** 资源显示名（据点卡未接管态的贡赋资源行） */
function resourceName(res: ResourceType): string {
  return game.resources.allMeta[res]?.name ?? res
}
</script>

<template>
  <section class="imperial-section" data-testid="imperial-section">
    <h3 class="section-title alert">
      {{ t('map.imperialSectionTitle') }}
      <span v-if="routeUnlocked" class="count-lead font-mono" data-testid="imperial-held-count">{{
        t('map.imperialHeldCount', { n: heldCount })
      }}</span>
    </h3>
    <p class="imperial-hint">{{ t('map.imperialSectionHint') }}</p>
    <p v-if="!routeUnlocked" class="locked-text" data-testid="imperial-route-locked">
      {{ t('map.imperialLocked') }}
    </p>
    <template v-else>
      <!-- 巡检卡：时间敏感置顶 -->
      <div
        v-if="auditView"
        class="imperial-audit"
        :class="{ 'ia-urgent': auditView.urgent }"
        :data-testid="`imperial-audit-${auditView.key}`"
      >
        <div class="ia-left">
          <span class="ia-title">{{ t('map.imperialAuditTitle') }}</span>
          <span class="ia-text">{{ auditView.text }}</span>
        </div>
        <div v-if="auditView.fightable" class="ia-actions">
          <button
            class="btn-accent ia-fight"
            data-testid="imperial-audit-fight"
            @click="toBattle('imperial_audit')"
          >
            {{ t('map.imperialAuditFight') }}
          </button>
          <button
            class="btn-secondary ia-pay"
            :disabled="!payAffordable"
            :data-testid="payAffordable ? 'imperial-audit-pay' : 'imperial-audit-pay-disabled'"
            @click="payAudit"
          >
            {{ t('map.imperialAuditPay') }}
            <template v-for="(row, i) in payCostRows" :key="row.id">
              <span v-if="i > 0"> · </span>{{ row.name }} {{ row.amount }}
            </template>
          </button>
        </div>
      </div>

      <!-- 6 座据点卡 -->
      <div class="imperial-grid">
        <div
          v-for="row in rows"
          :key="row.def.id"
          class="imperial-card"
          :class="{ captured: row.captured, suspended: row.suspended, locked: row.locked }"
          :data-testid="`imperial-${row.def.id}`"
        >
          <div class="ic-head">
            <span class="ic-name">
              {{ row.def.name }}
              <span
                v-if="row.isAuditTarget"
                class="ic-audit-badge"
                data-testid="imperial-audit-target-badge"
                >{{ t('map.imperialAuditTarget') }}</span
              >
            </span>
            <span v-if="row.captured" class="ic-tier font-mono">
              {{ t('map.imperialTier', { level: row.tier }) }}
            </span>
          </div>
          <p class="ic-desc">{{ row.def.desc }}</p>
          <div class="ic-status">
            <template v-if="row.locked">{{ row.requireLabel }}</template>
            <template v-else-if="row.suspended">
              <span class="ic-suspended">{{ t('map.imperialSuspended') }}</span>
            </template>
            <template v-else-if="row.captured">
              {{ t('map.imperialCaptured') }} · +{{ fmt(row.rate) }}/s
            </template>
            <template v-else>{{ resourceName(row.def.resource) }} +{{ fmt(row.rate) }}/s</template>
          </div>
          <div class="ic-actions">
            <button
              v-if="!row.locked && !row.captured"
              class="btn-accent"
              :data-testid="`imperial-${row.def.id}-capture`"
              @click="toBattle(row.def.id)"
            >
              {{ t('map.imperialCapture') }}
            </button>
            <template v-else-if="row.captured">
              <button
                v-if="!row.maxTier"
                class="btn-secondary"
                :disabled="!row.upgradeAffordable"
                :data-testid="`imperial-${row.def.id}-upgrade`"
                @click="upgradeStronghold(row.def.id)"
              >
                {{ t('map.imperialUpgrade') }}
                <template v-for="(r, i) in row.upgradeRows" :key="r.id">
                  <span v-if="i > 0"> · </span>{{ r.name }} {{ r.amount }}
                </template>
              </button>
              <span v-else class="ic-max">{{ t('map.imperialMaxTier') }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 贡赋池 -->
      <div class="imperial-pool" data-testid="imperial-pool">
        <div class="ip-head">
          <span class="ip-title">{{ t('map.imperialPoolTitle') }}</span>
          <span class="ip-cap font-mono">{{ t('map.imperialPoolCap') }}</span>
        </div>
        <div class="ip-bar">
          <div class="ip-fill" :style="{ width: (poolFill * 100).toFixed(1) + '%' }" />
        </div>
        <div class="ip-body">
          <div v-if="poolRows.length === 0" class="ip-empty">
            {{ t('map.imperialPoolEmpty') }}
          </div>
          <div v-else class="ip-rows font-mono">
            <template v-for="(row, i) in poolRows" :key="row.id">
              <span v-if="i > 0"> · </span>{{ row.name }} +{{ row.amount }}
            </template>
          </div>
          <button
            class="btn-accent ip-claim"
            :class="{ 'ip-claim-nearfull': poolNearFull }"
            :disabled="poolRows.length === 0"
            data-testid="imperial-pool-claim"
            @click="claimTribute"
          >
            {{
              poolNearFull && poolRows.length > 0
                ? t('map.imperialClaimNearFull')
                : t('map.imperialClaim')
            }}
          </button>
        </div>
      </div>

      <!-- 炉域（v1.83）：贡道尽头的倾贡入口，解锁后先进入再倾贡 -->
      <div class="imperial-forge" data-testid="imperial-forge">
        <div class="if-head">
          <span class="if-title">{{ t('content.imperialStrongholds.forge.name') }}</span>
          <span
            v-if="forgeEntered"
            class="if-stab font-mono"
            data-testid="imperial-forge-stability"
          >
            {{ t('content.imperialStrongholds.forge.stabilityLabel') }}
            {{ Math.floor(forgeStabilityNow) }}/{{ FORGE_STABILITY_MAX }}
          </span>
        </div>
        <p v-if="!forgeUnlocked" class="locked-text" data-testid="imperial-forge-locked">
          {{ t('content.imperialStrongholds.forge.lockedDesc') }}
        </p>
        <template v-else>
          <p class="if-desc">{{ t('content.imperialStrongholds.forge.desc') }}</p>
          <button
            v-if="!forgeEntered"
            class="btn-accent if-enter"
            data-testid="imperial-forge-enter"
            @click="enterForge"
          >
            {{ t('content.imperialStrongholds.forge.enter') }}
          </button>
          <template v-else>
            <div class="if-bar">
              <div
                class="if-fill"
                :style="{ width: (forgeStabilityNow / FORGE_STABILITY_MAX) * 100 + '%' }"
              />
            </div>
            <p class="if-pick font-mono" data-testid="imperial-forge-pick">
              {{ t('content.imperialStrongholds.forge.pickHint', { res: forgePickedName }) }}
            </p>
            <p class="if-remaining font-mono" data-testid="imperial-forge-remaining">
              {{ t('content.imperialStrongholds.forge.remaining', { n: forgeRemaining }) }}
            </p>
            <div class="if-tributes">
              <button
                v-for="row in forgeTributeRows"
                :key="row.id"
                class="btn-secondary if-tribute"
                :class="{ 'if-picked': row.picked }"
                :disabled="!row.affordable || forgeRemaining === 0"
                :title="t('content.imperialStrongholds.forge.tributeHint')"
                :data-testid="`imperial-forge-tribute-${row.id}`"
                @click="giveTribute(row.id)"
              >
                {{ t('content.imperialStrongholds.forge.tribute') }} · {{ row.name }}
                {{ fmt(row.cost) }}
                <span v-if="row.picked">×3</span>
              </button>
            </div>
            <p class="if-desc">{{ t('content.imperialStrongholds.forge.yieldDesc') }}</p>
            <p class="if-desc">{{ t('content.imperialStrongholds.forge.stabilityDesc') }}</p>
          </template>
        </template>
      </div>
    </template>
  </section>
</template>

<style scoped>
.imperial-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.imperial-hint {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.imperial-audit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}
/* 巡检临期/逾期警示（v1.82 QoL）：边框与文字转 alert 色 */
.imperial-audit.ia-urgent {
  border-color: var(--color-alert);
}
.imperial-audit.ia-urgent .ia-text {
  color: var(--color-alert);
  font-weight: 600;
}
/* 炉域（v1.83） */
.imperial-forge {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}
.if-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.if-title {
  font-weight: 600;
}
.if-stab {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.if-desc {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.if-bar {
  height: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
  overflow: hidden;
}
.if-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  transition: width 0.3s ease;
}
.if-pick {
  font-size: var(--text-sm);
  color: var(--color-accent);
}
.if-remaining {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.if-tributes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.if-tribute.if-picked {
  border-color: var(--color-accent);
}
.ia-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.ia-title {
  font-weight: 600;
}
.ia-text {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.ia-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-shrink: 0;
}
.ia-pay {
  font-size: var(--text-sm);
  white-space: nowrap;
}
.imperial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--space-3);
}
.imperial-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}
.imperial-card.locked {
  opacity: 0.55;
}
.imperial-card.suspended {
  border-color: var(--color-alert);
}
.ic-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}
.ic-name {
  font-weight: 600;
}
.ic-tier {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.ic-desc {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.ic-status {
  font-size: var(--text-sm);
}
.ic-suspended {
  color: var(--color-alert);
}
.ic-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
.ic-max {
  color: var(--color-t-secondary);
}
.imperial-pool {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
}
.ip-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.ip-title {
  font-weight: 600;
}
.ip-cap {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.ip-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--color-line);
  overflow: hidden;
}
.ip-fill {
  height: 100%;
  background: var(--color-accent, var(--color-t-secondary));
  transition: width 0.3s ease;
}
.ip-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}
.ip-rows {
  font-size: var(--text-sm);
}
.ip-empty {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
}
.ip-claim {
  flex-shrink: 0;
}
/* 池临满警示（v1.82 QoL）：领取按钮转 alert 强调；光晕静态挂伪元素，
   动画只驱动 opacity（合成器友好，对齐行动队列 in-progress 先例） */
.ip-claim.ip-claim-nearfull {
  --accent: var(--color-alert);
  position: relative;
}
.ip-claim.ip-claim-nearfull::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 12px 2px rgb(226 72 77 / 25%);
  opacity: 0;
  animation: claim-pulse 1.6s ease-in-out infinite;
  will-change: opacity;
  pointer-events: none;
}
@keyframes claim-pulse {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 390px) {
  .imperial-audit {
    flex-direction: column;
    align-items: stretch;
  }
  .ia-actions {
    flex-direction: row;
  }
  .ia-pay {
    white-space: normal;
  }
}
</style>
