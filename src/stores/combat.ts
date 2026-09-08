/**
 * combat.ts — PVE 战斗系统 store
 * 4 类据点、自动战斗结算、挂机驻扎
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Decimal } from '@/lib/decimal'
import { STRONGHOLDS, getStronghold, type StrongholdDef } from '@/data/pve'
import {
  MAX_ENDLESS_DEPTH,
  ENDLESS_STRONGHOLD_ID,
  endlessStronghold,
  endlessUnlocked,
} from '@/data/endless'
import { getUnit, type UnitId } from '@/data/units'
import type { Formation } from './military'
import { rollRelic, type RelicDef } from '@/data/relics'
import type { CombatSaveData } from '@/lib/storage'
import { fnv1a, mulberry32 } from '@/lib/random'

export interface BattleLogEntry {
  round: number
  msg: string
  side: 'player' | 'enemy' | 'system'
}

export interface BattleResult {
  victory: boolean
  log: BattleLogEntry[]
  rewards: { energy?: number; crystal?: number; alloy?: number; data?: number; dark?: number }
  relic?: RelicDef
  losses: Record<string, number> // 玩家损失 {unitId: count}
  rounds: number
}

/** 驻扎状态：据点 id → { formationId, startTime } */
export interface GarrisonState {
  strongholdId: string
  formationId: string
  startTime: number
}

// 战斗单位内部表示
interface CombatUnit {
  unitId: string
  name: string
  attack: number
  defense: number
  hp: number
  maxHp: number
  count: number
  isEnemy: boolean
  defRef?: UnitId // 关联玩家兵种定义用于克制判断
  counteredBy?: UnitId[] // 敌方单位被哪些玩家兵种克制
}

/** 正式据点 id 集合（远征合成据点 'endless' 不在其中） */
const STRONGHOLD_ID_SET = new Set(STRONGHOLDS.map((s) => s.id))

export const useCombatStore = defineStore('combat', () => {
  const garrisoned = ref<Record<string, GarrisonState>>({}) // strongholdId → state
  const completedStrongholds = ref<Set<string>>(new Set())
  // 无尽远征历史最深层数（v0.60）：跨转生保留（reset(false) 不清），hardReset 才清零
  const expeditionBest = ref(0)

  /**
   * 使战斗结果可复现（mulberry32，见 lib/random）
   *
   * 同一编队打同一据点，相同种子下结果完全一致，
   * 避免 SL 刷随机目标的投机行为。
   * 种子 = 编队内容哈希 + 据点 id + 当前时间分钟数
   */
  const _makeRng = mulberry32

  /** 从编队和据点信息派生战斗种子 */
  function _battleSeed(formation: Formation, strongholdId: string): number {
    const str = formation.id + ':' + strongholdId + ':' + Math.floor(Date.now() / 60000)
    return fnv1a(str)
  }

  /** 解锁的据点列表 */
  function availableStrongholds(unlockedNodes: Set<string>): StrongholdDef[] {
    return STRONGHOLDS.filter((s) => !s.requires || unlockedNodes.has(s.requires))
  }

  /**
   * 自动战斗结算（回合制模拟）
   * @param formation 玩家编队
   * @param stronghold 据点定义
   * @param atkMult 玩家攻击乘数
   * @param defMult 玩家防御乘数
   */
  function resolveBattle(
    formation: Formation,
    stronghold: StrongholdDef,
    atkMult: Decimal,
    defMult: Decimal
  ): BattleResult {
    const log: BattleLogEntry[] = []
    // 构建战斗单位列表
    const playerUnits: CombatUnit[] = []
    for (const [uid, count] of Object.entries(formation.units)) {
      if (count <= 0) continue
      const def = getUnit(uid as UnitId)
      if (!def) continue
      playerUnits.push({
        unitId: uid,
        name: def.name,
        attack: def.attack * atkMult.toNumber(),
        defense: def.defense * defMult.toNumber(),
        hp: def.hp,
        maxHp: def.hp,
        count,
        isEnemy: false,
        defRef: uid as UnitId,
      })
    }
    const enemyUnits: CombatUnit[] = stronghold.enemies.map((e) => ({
      unitId: e.unitId,
      name: e.name,
      attack: e.attack,
      defense: e.defense,
      hp: e.hp,
      maxHp: e.hp,
      count: e.count,
      isEnemy: true,
      counteredBy: e.counteredBy,
    }))

    if (playerUnits.length === 0) {
      return {
        victory: false,
        log: [{ round: 0, msg: '编队为空，无法出战', side: 'system' }],
        rewards: {},
        losses: {},
        rounds: 0,
      }
    }

    log.push({ round: 0, msg: `遭遇 ${stronghold.name} 守军`, side: 'system' })

    const rng = _makeRng(_battleSeed(formation, stronghold.id))
    let round = 0
    // 软墙设计（v0.52 确定）：保底伤害 1 + 50 回合上限配合使用。
    // 战斗为瞬时结算，该组合表示「越级挑战本该败」——低攻编队对高防据点
    // 每轮仅保底 1 点进展，50 回合磨不死即超时撤退判负；文案已有覆盖。
    // 去掉保底会出现 0 伤害僵局，去掉上限则蚂蚁可啃死大象，均非设计意图。
    const maxRounds = 50
    const losses: Record<string, number> = {}

    while (round < maxRounds) {
      round++
      // 玩方攻击
      for (const p of playerUnits) {
        if (p.count <= 0) continue
        const target = enemyUnits.filter((e) => e.count > 0)
        if (target.length === 0) break
        const tgt = target[Math.floor(rng() * target.length)]
        const defRef = getUnit(p.defRef!)
        let dmg = p.attack * p.count
        // 克制判断：敌方 unitId 上挂载 counteredBy 列表，检查当前玩家兵种是否在其中
        if (defRef && tgt.counteredBy?.includes(p.defRef!)) {
          dmg *= defRef.counterMult
        }
        const totalHp = tgt.hp * tgt.count
        const dmgDealt = Math.min(totalHp, Math.max(1, dmg - tgt.defense * tgt.count * 0.4))
        // 扣除血量
        const remaining = totalHp - dmgDealt
        if (remaining <= 0) {
          tgt.count = 0
          log.push({ round, msg: `${p.name} 消灭了 ${tgt.name}`, side: 'player' })
        } else {
          const newCount = Math.ceil(remaining / tgt.maxHp)
          tgt.count = newCount
          tgt.hp = remaining % tgt.maxHp || tgt.maxHp
        }
      }
      // 检查胜利
      if (enemyUnits.every((e) => e.count <= 0)) {
        log.push({ round, msg: '胜利！守军已被全歼', side: 'system' })
        return buildResult(true, log, stronghold, losses, round, rng)
      }
      // 敌方攻击
      for (const e of enemyUnits) {
        if (e.count <= 0) continue
        const target = playerUnits.filter((p) => p.count > 0)
        if (target.length === 0) break
        const tgt = target[Math.floor(rng() * target.length)]
        const dmg = e.attack * e.count
        const totalHp = tgt.hp * tgt.count
        const dmgDealt = Math.min(totalHp, Math.max(1, dmg - tgt.defense * tgt.count * 0.4))
        const remaining = totalHp - dmgDealt
        if (remaining <= 0) {
          losses[tgt.unitId] = (losses[tgt.unitId] || 0) + tgt.count
          tgt.count = 0
          log.push({ round, msg: `${e.name} 消灭了 ${tgt.name}`, side: 'enemy' })
        } else {
          const newCount = Math.ceil(remaining / tgt.maxHp)
          const lost = tgt.count - newCount
          if (lost > 0) {
            losses[tgt.unitId] = (losses[tgt.unitId] || 0) + lost
            log.push({ round, msg: `${e.name} 对 ${tgt.name} 造成 ${lost} 损失`, side: 'enemy' })
          }
          tgt.count = newCount
          tgt.hp = remaining % tgt.maxHp || tgt.maxHp
        }
      }
      // 检查失败
      if (playerUnits.every((p) => p.count <= 0)) {
        log.push({ round, msg: '全军覆没……', side: 'system' })
        return buildResult(false, log, stronghold, losses, round, rng)
      }
    }
    log.push({ round, msg: '战斗超时，双方撤退', side: 'system' })
    return buildResult(false, log, stronghold, losses, round, rng)
  }

  function buildResult(
    victory: boolean,
    log: BattleLogEntry[],
    stronghold: StrongholdDef,
    losses: Record<string, number>,
    rounds: number,
    rng: () => number
  ): BattleResult {
    // 限制日志条数：保留首条（遭遇）+ 最后 MAX_LOG-1 条
    const MAX_LOG = 30
    const trimmedLog = log.length > MAX_LOG ? [log[0], ...log.slice(-(MAX_LOG - 1))] : log

    const rewards: BattleResult['rewards'] = {}
    let relic: RelicDef | undefined
    if (victory) {
      const r = stronghold.rewards
      if (r.energy) rewards.energy = r.energy
      if (r.crystal) rewards.crystal = r.crystal
      if (r.alloy) rewards.alloy = r.alloy
      if (r.data) rewards.data = r.data
      if (r.dark) rewards.dark = r.dark
      // 遗物掉落
      if (r.relicChance && rng() < r.relicChance) {
        relic = rollRelic(r.relicRarityBias ?? 0, rng)
        trimmedLog.push({ round: rounds, msg: `发现遗物：${relic.name}！`, side: 'system' })
      }
      // 远征合成据点（id='endless'，不在 STRONGHOLDS 白名单内）不入正式通关集：
      // 其进度由 expeditionBest 独立承担，误入会导致存档校验整档失败
      if (stronghold.id !== ENDLESS_STRONGHOLD_ID) {
        completedStrongholds.value.add(stronghold.id)
      }
    }
    return { victory, log: trimmedLog, rewards, relic, losses, rounds }
  }

  /** 驻扎据点（挂机） */
  function garrison(strongholdId: string, formationId: string): boolean {
    if (garrisoned.value[strongholdId]) return false
    garrisoned.value[strongholdId] = { strongholdId, formationId, startTime: Date.now() }
    return true
  }

  // —— 无尽远征（v0.60）——

  /** 远征是否已解锁（本轮须已攻克解锁锚点据点） */
  function isEndlessUnlocked(): boolean {
    return endlessUnlocked(completedStrongholds.value)
  }

  /** 按深度取远征据点定义（合成，不入 STRONGHOLDS 表） */
  function getEndlessStronghold(depth: number): StrongholdDef {
    return endlessStronghold(depth)
  }

  /**
   * 记录远征战果：仅「攻克当前前沿」（depth = expeditionBest + 1）的胜利推进深度。
   * 重打已过深度不推进；失败由调用方短路（不调本函数）。
   * @returns 深度是否被推进
   */
  function recordExpedition(depth: number, victory: boolean): boolean {
    if (!victory) return false
    const d = Math.max(1, Math.floor(depth))
    if (d > MAX_ENDLESS_DEPTH) return false
    if (d !== expeditionBest.value + 1) return false
    expeditionBest.value = d
    return true
  }
  /** 撤回驻扎 */
  function ungarrison(strongholdId: string) {
    delete garrisoned.value[strongholdId]
  }
  /** 获取驻扎挂机收益（每秒） */
  function garrisonIdleReward(strongholdId: string): Record<string, number> {
    const s = getStronghold(strongholdId)
    if (!s) return {}
    return { ...s.idle }
  }

  /**
   * 所有驻扎据点的合并产出（每秒）—— computed 缓存
   * 仅在 garrisoned 变化时重算，避免每 tick 遍历
   */
  const garrisonProduction = computed<Record<string, number>>(() => {
    const result: Record<string, number> = {}
    for (const sid of Object.keys(garrisoned.value)) {
      const idle = garrisonIdleReward(sid)
      for (const [res, v] of Object.entries(idle)) {
        result[res] = (result[res] || 0) + v
      }
    }
    return result
  })

  function reset(fullReset = false) {
    // 驻扎与本轮通关状态：转生与 hardReset 均清（沿用既有转生语义）
    garrisoned.value = {}
    completedStrongholds.value = new Set()
    if (fullReset) {
      // 远征深度为终身进度：仅 hardReset（fullReset）清零，转生保留
      expeditionBest.value = 0
    }
  }

  function serialize() {
    return {
      garrisoned: { ...garrisoned.value },
      // 双保险：白名单过滤（buildResult 已排除远征合成据点，此处兜底任何来源的非法 id）
      completed: Array.from(completedStrongholds.value).filter((id) => STRONGHOLD_ID_SET.has(id)),
      expeditionBest: expeditionBest.value,
    }
  }
  function hydrate(data: CombatSaveData | undefined) {
    if (!data) return
    if (data.garrisoned) garrisoned.value = { ...data.garrisoned }
    // 白名单过滤：非正式据点 id（含远征 'endless'）一律不载入通关集
    if (data.completed) {
      completedStrongholds.value = new Set(data.completed.filter((id) => STRONGHOLD_ID_SET.has(id)))
    }
    // 远征深度：旧档缺失保持 0；防御性钳制非负整数
    if (typeof data.expeditionBest === 'number' && isFinite(data.expeditionBest)) {
      expeditionBest.value = Math.max(0, Math.floor(data.expeditionBest))
    }
  }

  return {
    garrisoned,
    completedStrongholds,
    expeditionBest,
    garrisonProduction,
    availableStrongholds,
    resolveBattle,
    garrison,
    isEndlessUnlocked,
    getEndlessStronghold,
    recordExpedition,
    ungarrison,
    garrisonIdleReward,
    reset,
    serialize,
    hydrate,
  }
})
