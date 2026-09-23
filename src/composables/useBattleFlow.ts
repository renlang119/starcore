/**
 * useBattleFlow.ts — 战斗页流程状态机（从 BattleView 拆出）。
 *
 * 覆盖四组流程：战斗执行与战损/奖励结算、结果弹窗控制、驻扎切换与
 * 确认、战损提示。依赖的派生值（据点 / 编队 / 远征深度 / 无尽标识）
 * 由调用方注入；行为、文案与结算时序与拆分前一致。
 */
import { t } from '@/i18n'
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { fmt } from '@/lib/format'
import { resourceRows } from '@/lib/resource-rows'
import type { ResourceType } from '@/data/buildings'
import type { StrongholdDef } from '@/data/pve'
import type { useCombatStore } from '@/stores/combat'
import type { BattleLogEntry } from '@/stores/combat'
import { useToast } from '@/composables/useToast'

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

  const isGarrisoned = computed(() => !!game.combat.garrisoned[deps.strongholdId.value])

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
    const result = game.combat.resolveBattle(
      deps.formation.value,
      deps.stronghold.value,
      game.atkMult,
      game.defMult
    )
    battleLog.value = result.log
    battleResult.value = result
    showResult.value = true
    applyBattleLosses(result)
    // 敌方图鉴：交战即记录遭遇条目（胜负都算；远征合成编成在 store 内排除）
    game.archive.recordEncounter(deps.stronghold.value.id, deps.stronghold.value.enemies)
    // 无尽远征：攻克当前前沿 → 推进历史最深深度（随奖励即时发放，见 grantRewards）
    // 成就终身计数：据点攻克（胜利）次数（远征战果同样计入战斗里程碑）
    if (result.victory) {
      game.achievements.recordBattle()
      game.achievements.checkAndUnlock()
      game.daily.bump('battles')
      // 奖励即时发放（v0.94）：战斗结算即落袋，结果弹窗只做展示；
      // 修复弹窗打开期间离开页面导致资源、遗物与远征推进丢失的问题
      grantRewards(result)
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
      } else if (totalLoss > 0) {
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
    if (battleResult.value?.victory) {
      router.push('/map')
    }
  }

  function stayHere() {
    showResult.value = false
    battleLog.value = null
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
    garrisonPreview,
    toast,
    startBattle,
    confirmResult,
    stayHere,
    toggleGarrison,
    confirmGarrison,
    cancelGarrison,
  }
}
