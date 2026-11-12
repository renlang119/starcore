/**
 * useBattleFlow.ts：战斗页流程状态机（从 BattleView 拆出）。
 *
 * 覆盖四组流程：战斗执行与战损/奖励结算、结果弹窗控制、驻扎切换与
 * 确认、战损提示。依赖的派生值（据点 / 编队 / 远征深度 / 无尽标识）
 * 由调用方注入；行为、文案与结算时序与拆分前一致。
 */
import { t } from '@/i18n'
import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { resourceRows } from '@/lib/resource-rows'
import type { ResourceType } from '@/data/buildings'
import type { StrongholdDef } from '@/data/pve'
import type { useCombatStore } from '@/stores/combat'
import type { BattleLogEntry, BattleReplayFrame } from '@/stores/combat'
import { useToast } from '@/composables/useToast'
import { IMPERIAL_AUDIT_ID, getImperialStronghold } from '@/data/imperial-strongholds'

type CombatStore = ReturnType<typeof useCombatStore>
/** 战斗结果类型由 store 推导（v0.77，替换 any） */
export type BattleResult = ReturnType<CombatStore['resolveBattle']>
type GameStore = ReturnType<typeof useGameStore>
type Formation = GameStore['military']['formations'][number]

export interface BattleFlowDeps {
  strongholdId: ComputedRef<string>
  stronghold: ComputedRef<StrongholdDef | undefined>
  formation: ComputedRef<Formation | undefined>
  isEndless: ComputedRef<boolean>
  endlessDepth: Ref<number>
  /** 是否周 Boss（v1.24 方案 5：/battle/weekly_boss；胜利走 daily 记账不入通关集） */
  isWeeklyBoss?: ComputedRef<boolean>
  /** 是否帝庭据点（v1.81：接管战斗 / 巡检迎战；胜利走接管或巡检记账，不入通关集） */
  isImperial?: ComputedRef<boolean>
}

export function useBattleFlow(deps: BattleFlowDeps) {
  const game = useGameStore()
  const router = useRouter()

  // 战损 toast（v0.82 战损结算：编队减员即时提示）
  const toast = useToast()

  const battleLog = ref<BattleLogEntry[] | null>(null)
  const battleResult = ref<BattleResult | null>(null)
  const showResult = ref(false)
  const showGarrisonConfirm = ref(false)

  /**
   * 交战据点快照（v1.81 PR #24 修复 1）：开战瞬间冻结，战报播出与结果
   * 弹窗期间由展示侧优先渲染。巡检迎战结算后 audit 状态即变（实时据点
   * 计算随之 undefined），不冻结会把整页连同战报与弹窗一起卸载。
   */
  const engagedStronghold = ref<StrongholdDef | null>(null)

  // 战报播出（v1.56 战斗过程演出）：结算完成后页内战报逐条入场，
  // 播完或跳过后结果弹窗才出场；减动效偏好直出弹窗。
  // 播放纯表现，奖励与战损仍在结算时即时落袋（v0.94 口径不变）。
  const displayedLog = ref<BattleLogEntry[] | null>(null)
  const battleReplay = ref<BattleReplayFrame[] | null>(null)
  const playing = ref(false)
  let playTimer: ReturnType<typeof setInterval> | null = null
  /** 播出节奏：基准间隔 220ms，按条数自适应收紧，播放段总时长封顶约 4 秒 */
  const PLAY_INTERVAL = 220
  const PLAY_BUDGET = 3600

  /** 对阵舞台当前帧（v1.65）：与战报播出同索引推进（显示第 N 条时取第 N 帧） */
  const stageFrame = computed<BattleReplayFrame | null>(() => {
    const frames = battleReplay.value
    const shown = displayedLog.value?.length ?? 0
    if (!frames || frames.length === 0 || shown === 0) return null
    return frames[Math.min(shown, frames.length) - 1] ?? null
  })

  function clearPlayTimer() {
    if (playTimer) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  /** 减动效偏好探测：jsdom 等无 matchMedia 环境按非 reduce 处理 */
  function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function onPlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') skipPlayback()
  }

  function startPlayback(log: BattleLogEntry[]) {
    clearPlayTimer()
    displayedLog.value = log
    // 战报过短（空编成/空敌方快速失败）或减动效：不播，弹窗即出
    if (log.length <= 1 || prefersReducedMotion()) {
      showResult.value = true
      return
    }
    playing.value = true
    displayedLog.value = []
    const step = Math.max(60, Math.min(PLAY_INTERVAL, PLAY_BUDGET / log.length))
    let shown = 0
    window.addEventListener('keydown', onPlayKeydown)
    playTimer = setInterval(() => {
      shown++
      displayedLog.value = log.slice(0, shown)
      if (shown >= log.length) finishPlayback()
    }, step)
  }

  function finishPlayback() {
    clearPlayTimer()
    window.removeEventListener('keydown', onPlayKeydown)
    displayedLog.value = battleLog.value
    playing.value = false
    showResult.value = true
  }

  /** 跳过播出：立即补全战报并弹出结果弹窗（播放期外调用无副作用） */
  function skipPlayback() {
    if (playing.value) finishPlayback()
  }

  onScopeDispose(() => {
    clearPlayTimer()
    window.removeEventListener('keydown', onPlayKeydown)
  }, true)

  const isGarrisoned = computed(() => !!game.combat.garrisoned[deps.strongholdId.value])
  /** 本周 Boss 是否已击败（v1.24：出战按钮禁用依据，防重复领取奖励） */
  const isWeeklyBossDefeated = computed(() =>
    deps.isWeeklyBoss?.value ? game.daily.isWeeklyBossDefeated() : false
  )

  // 驻扎收益预览（每秒 + 每小时）：传入当前选中编队 id（驻扎前预览也吃特性乘区）
  const garrisonPreview = computed(() => {
    const fid = deps.formation.value?.id
    const idle = game.combat.garrisonIdleReward(deps.strongholdId.value, fid)
    return resourceRows(idle, game.resources.allMeta, { positiveOnly: true }).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      perSec: r.amount,
      perHour: fmt(Number(idle[r.id]) * 3600),
    }))
  })

  function startBattle() {
    if (!deps.stronghold.value || !deps.formation.value) return
    // 战报播出期防连点重入（出征按钮同步禁用，此处兜底）
    if (playing.value) return
    // 周 Boss 已击败：按钮禁用兜底外的防御短路（不重复结算不重复发奖）
    if (deps.isWeeklyBoss?.value && game.daily.isWeeklyBossDefeated()) return
    // 冻结交战据点：结算后实时据点计算可能转 undefined（巡检状态即变），
    // 战报与弹窗期间以快照渲染
    engagedStronghold.value = deps.stronghold.value
    const result = game.combat.resolveBattle(
      deps.formation.value,
      deps.stronghold.value,
      game.atkMult,
      game.defMult
    )
    battleLog.value = result.log
    battleResult.value = result
    // 回放帧（v1.65）：与战报同索引，供对阵舞台逐条推进
    battleReplay.value = result.replay ?? null
    // 结果弹窗改由战报播出收尾出场（v1.56）：逐条播完或跳过后 showResult 置真
    startPlayback(result.log)
    applyBattleLosses(result)
    // 敌方图鉴：交战即记录遭遇条目（胜负都算；远征/周 Boss 合成编成在 store 内排除）
    game.archive.recordEncounter(deps.stronghold.value.id, deps.stronghold.value.enemies)
    // 无尽远征：攻克当前前沿 → 推进历史最深深度（随奖励即时发放，见 grantRewards）
    // 成就终身计数：据点攻克（胜利）次数（远征战果同样计入战斗里程碑）
    if (result.victory) {
      game.achievements.recordBattle()
      game.achievements.checkAndUnlock()
      game.daily.bump('battles')
      // 周 Boss 胜利：记账「本周已击败」（奖励随下方 grantRewards 按据点
      // rewards 即时发放；不入通关集、不入图鉴，见各 store 排除口径）
      if (deps.isWeeklyBoss?.value) {
        game.daily.claimWeeklyBoss()
      }
      // 帝庭据点胜利（v1.81）：接管据点或巡检通过（合成据点 rewards 已清空，
      // 不走 grantRewards；不入通关集、不入图鉴，见各 store 排除口径）
      if (deps.isImperial?.value) {
        if (deps.strongholdId.value === IMPERIAL_AUDIT_ID) {
          game.settleImperialAudit(true)
          toast.show(t('battle.imperialAuditWin'))
        } else {
          game.imperial.capture(deps.strongholdId.value)
          toast.show(t('battle.imperialWin', { name: deps.stronghold.value?.name ?? '' }))
        }
      }
      // 奖励即时发放（v0.94）：战斗结算即落袋，结果弹窗只做展示；
      // 修复弹窗打开期间离开页面导致资源、遗物与远征推进丢失的问题
      grantRewards(result)
    } else if (deps.isImperial?.value && deps.strongholdId.value === IMPERIAL_AUDIT_ID) {
      // 巡检迎战失败（v1.81）：目标失守（整备保留，重夺后恢复产出）；
      // 提示取巡检目标据点名（合成据点名是巡检舰队名，非失守对象）
      game.settleImperialAudit(false)
      const target = getImperialStronghold(game.imperial.audit?.targetId ?? '')
      toast.show(t('battle.imperialAuditLose', { name: target?.name ?? '' }))
    }
  }

  /**
   * 战损结算（v0.82 战损接线）：胜负都按 losses 从编队扣兵，战报「损失 N 支」由此为真。
   * 编队全灭清空该编队；若该编队驻扎中自动撤驻（收益随撤驻停止）并 toast 提示。
   */
  function applyBattleLosses(result: BattleResult) {
    const f = deps.formation.value
    if (!f) return
    game.military.applyLosses(f, result.losses as never)
    const totalLoss = Object.values(result.losses).reduce((a, b) => a + b, 0)
    if (totalLoss > 0) {
      const survivors = Object.values(f.units).reduce((a, b) => a + b, 0)
      if (survivors === 0) {
        toast.show(t('battle.logWiped', { formationName: f.name }))
        // 全灭的编队若驻扎中，自动撤驻
        for (const [sid, g] of Object.entries(game.combat.garrisoned)) {
          if (g.formationId === f.id) {
            game.combat.ungarrison(sid)
            toast.show(t('battle.logWithdrawn', { formationName: f.name }))
            break
          }
        }
      } else {
        toast.show(t('battle.logLosses', { formationName: f.name, totalLoss: totalLoss }))
      }
    }
  }

  /** 胜利奖励即时发放（v0.94）：战斗结算时调用一次，不依赖弹窗交互 */
  function grantRewards(result: BattleResult) {
    for (const [k, v] of Object.entries(result.rewards)) {
      if (v) game.resources.gain(k as ResourceType, v as number)
    }
    if (result.relic) game.relics.obtain(result.relic)
    // 远征：奖励落袋的同时记录战果（攻克当前前沿才推进，重打不推进）；
    // 推进计入周挑战远征类计数（重打不计，与推进口径一致）
    if (deps.isEndless.value) {
      const advanced = game.combat.recordExpedition(deps.endlessDepth.value, true)
      if (advanced) game.daily.bump('expedition')
    }
  }

  function confirmResult() {
    showResult.value = false
    engagedStronghold.value = null
    if (battleResult.value?.victory) {
      router.push('/map')
    }
  }

  function stayHere() {
    showResult.value = false
    battleLog.value = null
    displayedLog.value = null
    battleReplay.value = null
    engagedStronghold.value = null
  }

  function toggleGarrison() {
    if (isGarrisoned.value) {
      // 撤回驻扎：直接撤回
      game.combat.ungarrison(deps.strongholdId.value)
    } else {
      // 驻扎：弹出收益确认提示
      showGarrisonConfirm.value = true
    }
  }

  function confirmGarrison() {
    if (!deps.formation.value) {
      showGarrisonConfirm.value = false
      return
    }
    const ok = game.combat.garrison(deps.strongholdId.value, deps.formation.value.id)
    if (!ok) {
      // 守卫拒绝（未攻克/编队被他处占用等）：提示而非静默
      toast.show(isGarrisoned.value ? t('battle.garrisonOccupied') : t('battle.garrisonBlocked'))
    }
    showGarrisonConfirm.value = false
  }

  function cancelGarrison() {
    showGarrisonConfirm.value = false
  }

  return {
    battleLog,
    battleResult,
    showResult,
    showGarrisonConfirm,
    isGarrisoned,
    isWeeklyBossDefeated,
    garrisonPreview,
    engagedStronghold,
    toast,
    displayedLog,
    battleReplay,
    playing,
    stageFrame,
    startBattle,
    skipPlayback,
    confirmResult,
    stayHere,
    toggleGarrison,
    confirmGarrison,
    cancelGarrison,
  }
}
