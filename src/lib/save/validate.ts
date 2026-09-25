/**
 * save/validate.ts — 存档校验与自愈修复（从 storage.ts 拆出）。
 *
 * 负责结构完整性与内容范围校验（防注入/损坏），以及在整档拒绝前
 * 对历史存档已知缺陷做条目级自愈修复（只剥离/补齐可推导的部分）。
 */
import { SAVE_VERSION, type SaveData } from './schema'
import { BUILDINGS } from '@/data/buildings'
import { TECHS } from '@/data/tech'
import { UNITS, defaultFormations } from '@/data/units'
import { EXPLORE_NODES } from '@/data/explore'
import { STRONGHOLDS } from '@/data/pve'
import { MILESTONE_STEP } from '@/data/endless'
import { RELIC_POOL, MAX_RELIC_LEVEL } from '@/data/relics'
import { INFINITE_NODE_IDS, MAX_INFINITE_NODE_LEVEL } from '@/stores/transcend'
import { ARCHIVE_ENEMY_KEYS } from '@/stores/archive'
import { ENCOUNTER_IDS } from '@/data/encounters'

// —— 有效 ID 集合（用于 validateSaveData 内容范围校验）——
const BUILDING_IDS = new Set(BUILDINGS.map((b) => b.id))
const TECH_IDS = new Set(TECHS.map((t) => t.id))
const UNIT_IDS = new Set<string>(UNITS.map((u) => u.id))
const EXPLORE_NODE_IDS = new Set(EXPLORE_NODES.map((n) => n.id))
const STRONGHOLD_IDS = new Set(STRONGHOLDS.map((s) => s.id))
const RELIC_IDS = new Set(RELIC_POOL.map((r) => r.id))

/** 存档版本高于当前版本 → 返回该版本号（不静默 hydrate 未知结构），否则 null */
export function tooNewVersion(data: unknown): number | null {
  if (!_isObject(data)) return null
  const v = data.version
  if (typeof v === 'number' && isFinite(v) && v > SAVE_VERSION) return v
  return null
}

/**
 * 修复历史存档已知缺陷后再校验（自愈项不改语义，只剥离/补齐可推导的部分）：
 * 1. completed 混入非正式据点 id（v0.60 远征胜利会把 'endless' 写入通关集，
 *    主备档双双过不了白名单校验）→ 剥离该条目继续，不整档拒绝。
 * 2. formations 空数组（v0.81）：空数组能通过 every 校验但 hydrate 后编队为 0 支，
 *    战斗页直接读 formations[idx].units 崩溃 → 按默认 f1/f2/f3 补齐空编队
 * 3. 条目级剥离未知 id（v0.93）：版本迭代删除/重命名建筑、科技或遗物 id 时，
 *    老档不应整档判废——与字段自身的结构/范围校验（仍整档拒绝）区分开，
 *    未知 id 只损失对应进度，其余进度保留。字段口径与 combat.completed 一致。
 * 4. equipped 槽位引用修复（v0.93）：指向 owned 中不存在实例的槽位置空、
 *    重复出现的实例只保留首个槽位——同一实例重复占槽会双计装备效果
 *    与套装件数，属可推导修复；与 hydrate 侧防御同步生效。
 */
export function validateAndRepair(data: unknown): data is SaveData {
  if (_isObject(data)) {
    const cb = data.combat
    if (_isObject(cb) && Array.isArray(cb.completed)) {
      cb.completed = cb.completed.filter((id) => typeof id === 'string' && STRONGHOLD_IDS.has(id))
    }
    // combat.milestonesClaimed：剥离伪领（超 expeditionBest 达标档）与非法条目，
    // 去重升序（v1.20；口径同 combat store hydrate 侧自愈，两层防御同先例）
    if (_isObject(cb) && Array.isArray(cb.milestonesClaimed)) {
      const bestRaw = (cb as { expeditionBest?: unknown }).expeditionBest
      const best =
        typeof bestRaw === 'number' && isFinite(bestRaw) ? Math.max(0, Math.floor(bestRaw)) : 0
      const maxTier = Math.max(0, Math.floor(best / MILESTONE_STEP))
      const seen = new Set<number>()
      for (const t of cb.milestonesClaimed) {
        if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > maxTier) continue
        seen.add(t)
      }
      cb.milestonesClaimed = [...seen].sort((a, b) => a - b)
    }
    const mil = data.military
    if (_isObject(mil) && Array.isArray(mil.formations) && mil.formations.length === 0) {
      mil.formations = defaultFormations()
    }
    // buildings.levels：剥离未知建筑 id（键值结构仍由 validateSaveData 把关）
    const bld = data.buildings
    if (_isObject(bld) && _isObject(bld.levels)) {
      for (const key of Object.keys(bld.levels)) {
        if (!BUILDING_IDS.has(key)) delete bld.levels[key]
      }
    }
    // research.completed：剥离未知科技 id
    const rsh = data.research
    if (_isObject(rsh) && Array.isArray(rsh.completed)) {
      rsh.completed = rsh.completed.filter(
        (id: unknown) => typeof id === 'string' && TECH_IDS.has(id)
      )
    }
    // relics.owned：剥离未知遗物 id 条目；equipped 引用修复（见函数头注 4）
    const rlc = data.relics
    if (_isObject(rlc)) {
      if (Array.isArray(rlc.owned)) {
        rlc.owned = rlc.owned.filter(
          (r: unknown) => _isObject(r) && typeof r.id === 'string' && RELIC_IDS.has(r.id)
        )
      }
      if (Array.isArray(rlc.equipped)) {
        const ownedIds = new Set(
          (rlc.owned as { instanceId?: unknown }[]).map((r) =>
            _isObject(r) ? r.instanceId : undefined
          )
        )
        const seen = new Set<string>()
        rlc.equipped = (rlc.equipped as unknown[]).map((e) => {
          if (typeof e !== 'string' || !ownedIds.has(e) || seen.has(e)) return null
          seen.add(e)
          return e
        })
      }
    }
    // archive.enemies：剥离未知图鉴条目键（口径同 combat.completed 的条目级剥离）
    const arc = data.archive
    if (_isObject(arc) && Array.isArray(arc.enemies)) {
      arc.enemies = arc.enemies.filter(
        (k: unknown) => typeof k === 'string' && ARCHIVE_ENEMY_KEYS.has(k)
      )
    }
    // encounters.pendingEventId：剥离未知事件 id（v1.26；挂起丢失零损失，
    // 与「未知 id 只损失对应进度」的条目级剥离口径一致）
    const enc = data.encounters
    if (_isObject(enc) && enc.pendingEventId !== undefined) {
      if (typeof enc.pendingEventId !== 'string' || !ENCOUNTER_IDS.has(enc.pendingEventId)) {
        delete enc.pendingEventId
      }
    }
    // military.dispatches：剥离未知编队 id 条目（v1.27；在途派遣丢失零损失，
    // 与 encounters 同条目级剥离口径；编队白名单 = 存档内 formations 的 id 集）
    const mil0 = data.military
    if (_isObject(mil0) && _isObject(mil0.dispatches) && Array.isArray(mil0.formations)) {
      const fids = new Set(
        mil0.formations
          .map((f: unknown) => (_isObject(f) && typeof f.id === 'string' ? f.id : null))
          .filter((id): id is string => id !== null)
      )
      for (const fid of Object.keys(mil0.dispatches)) {
        if (!fids.has(fid)) delete mil0.dispatches[fid]
      }
    }
  }
  return validateSaveData(data)
}

/**
 * 校验存档数据结构完整性与内容范围（防注入/损坏）
 */
function validateSaveData(data: unknown): data is SaveData {
  if (data == null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!_isNonNegFinite(d.version) || d.version < 1 || d.version > SAVE_VERSION) return false
  if (!_isNonNegFinite(d.savedAt)) return false
  // player（可选字段）：存在则须为对象；名字段须为字符串且长度不超过 24
  // （名字段会在存档管理区展示，约束类型与长度防脏值上屏）
  if (d.player != null) {
    if (!_isObject(d.player)) return false
    const p = d.player as Record<string, unknown>
    if (typeof p.name !== 'string' || p.name.length > 24) return false
  }
  // totalPlayTime（可选字段）：存在则必须是非负有限数字
  if (d.totalPlayTime !== undefined && !_isNonNegFinite(d.totalPlayTime)) return false

  // resources: amounts/totals 必须是非负有限数字字符串
  if (!_isObject(d.resources)) return false
  const res = d.resources as Record<string, unknown>
  if (!_isNonNegNumberStrRecord(res.amounts)) return false
  if (!_isNonNegNumberStrRecord(res.totals)) return false

  // buildings: levels key 必须是有效建筑 ID，value 必须是非负整数
  // （未知 id 在 _validateAndRepair 剥离后到达此处，见该函数头注 3）
  if (!_isObject(d.buildings)) return false
  if (!_isValidIdNumberRecord((d.buildings as Record<string, unknown>).levels, BUILDING_IDS, true))
    return false

  // research: completed 数组元素必须是有效科技 ID
  // （未知 id 在 _validateAndRepair 剥离后到达此处）
  if (!_isObject(d.research)) return false
  const research = d.research as Record<string, unknown>
  if (!_isValidStrArray(research.completed, TECH_IDS)) return false

  // military: owned key 必须是有效兵种 ID，value 非负整数（兵力不可为小数）
  if (!_isObject(d.military)) return false
  const mil = d.military as Record<string, unknown>
  if (!_isValidIdNumberRecord(mil.owned, UNIT_IDS, true)) return false
  // training: 条目结构 + unitId 白名单 + 数字字段有限（防 NaN 任务占死训练槽）；
  // count 必须为非负整数（v0.81：小数 count 完成后 owned += count 产小数兵力，
  // 被 owned 的 intOnly 校验拒绝 → 整档判废）；remaining/totalTime 为秒数，浮点合法
  if (!Array.isArray(mil.training)) return false
  if (
    !mil.training.every((t: unknown) => {
      if (!_isObject(t)) return false
      if (typeof t.id !== 'string') return false
      if (typeof t.unitId !== 'string' || !UNIT_IDS.has(t.unitId)) return false
      if (!_isNonNegInt(t.count)) return false
      for (const k of ['remaining', 'totalTime']) {
        if (!_isNonNegFinite(t[k])) return false
      }
      return true
    })
  )
    return false
  // formations: 条目结构 + units 键白名单 + 值有限（防缺键加法产 NaN）；
  // trait 可选（v1.23）：存在则须为字符串（形态校验）；未知 id 不拒档，
  // hydrate 读取侧回落均衡（装饰性字段不 brick 玩家存档）
  if (!Array.isArray(mil.formations)) return false
  if (
    !mil.formations.every((f: unknown) => {
      if (!_isObject(f)) return false
      if (typeof f.id !== 'string' || typeof f.name !== 'string') return false
      if (f.trait !== undefined && typeof f.trait !== 'string') return false
      if (!_isObject(f.units)) return false
      for (const [uid, n] of Object.entries(f.units)) {
        if (!UNIT_IDS.has(uid)) return false
        if (!_isNonNegFinite(n)) return false
      }
      return true
    })
  )
    return false
  // dispatches（v1.27 可选字段）：存在则校验结构。编队 id 白名单已在
  // _validateAndRepair 剥离（未知条目只损失在途派遣，不拒整档）；
  // hours 须为正数（读取侧再按档位表白名单过滤）；startTime 非负有限
  if (mil.dispatches !== undefined) {
    if (!_isObject(mil.dispatches)) return false
    for (const d of Object.values(mil.dispatches)) {
      if (!_isObject(d)) return false
      const { hours, startTime } = d as { hours: unknown; startTime: unknown }
      if (!_isNonNegFinite(hours) || !(hours > 0)) return false
      if (!_isNonNegFinite(startTime)) return false
    }
  }

  // combat: completed 元素必须是有效据点 ID；garrisoned 键与条目须在据点白名单内
  if (!_isObject(d.combat)) return false
  const cb = d.combat as Record<string, unknown>
  if (cb.garrisoned !== undefined) {
    if (!_isObject(cb.garrisoned)) return false
    for (const [sid, g] of Object.entries(cb.garrisoned)) {
      if (!STRONGHOLD_IDS.has(sid)) return false
      if (!_isObject(g)) return false
      if (typeof g.strongholdId !== 'string' || !STRONGHOLD_IDS.has(g.strongholdId)) return false
      if (typeof g.formationId !== 'string') return false
      if (!_isNonNegFinite(g.startTime)) return false
    }
  }
  if (!_isValidStrArray(cb.completed, STRONGHOLD_IDS)) return false
  // milestonesClaimed（v1.20 可选）：结构须为数组——条目级净化在 validateAndRepair
  // 完成（伪领/非法条目剥离），非数组无法自愈，整档拒绝（与 completed 同口径）
  if (cb.milestonesClaimed !== undefined && !Array.isArray(cb.milestonesClaimed)) return false

  // exploration: progress 条目须结构合法且时间戳有限；未知节点条目丢弃（hydrate 只取已知节点）
  if (!_isObject(d.exploration)) return false
  const expProg = (d.exploration as Record<string, unknown>).progress
  if (!_isObject(expProg)) return false
  for (const [key, val] of Object.entries(expProg)) {
    if (!EXPLORE_NODE_IDS.has(key)) continue
    if (!_isObject(val)) return false
    const p = val as Record<string, unknown>
    if (p.nodeId !== key) return false
    if (!_isNonNegFinite(p.startTime) || !_isNonNegFinite(p.endTime)) return false
    if (!_isBool(p.completed)) return false
  }

  // relics: owned 条目的 id 必须是有效遗物 ID（未知 id 条目在 _validateAndRepair
  // 剥离后到达此处）；level（v0.70 可选字段）非负整数 ≤ MAX_RELIC_LEVEL
  if (!_isObject(d.relics)) return false
  const rl = d.relics as Record<string, unknown>
  if (!Array.isArray(rl.owned)) return false
  if (
    !rl.owned.every((r: unknown) => {
      if (!_isObject(r) || typeof r.id !== 'string' || !RELIC_IDS.has(r.id)) return false
      if (typeof r.instanceId !== 'string' || typeof r.obtainedAt !== 'number') return false
      if (r.level !== undefined && (!_isNonNegInt(r.level) || r.level > MAX_RELIC_LEVEL))
        return false
      return true
    })
  )
    return false
  if (!Array.isArray(rl.equipped)) return false
  if (!rl.equipped.every((e: unknown) => e === null || typeof e === 'string')) return false

  // transcend: tree 条目结构校验（id + 非负整数 level）；
  // 无限节点 level 设硬上限（v0.81：超大等级值曾可经 allEffects 物化数组挂死首帧）
  if (!_isObject(d.transcend)) return false
  const tc = d.transcend as Record<string, unknown>
  if (tc.negativeEntropy !== undefined && !_isNonNegNumberStr(tc.negativeEntropy)) return false
  // totalTranscends：存在则必须是非负整数（v0.81 收口：NaN/负值/Infinity 曾可入档，
  // 负值使首转保底 +1 永久失效）
  if (tc.totalTranscends !== undefined && !_isNonNegInt(tc.totalTranscends)) return false
  if (!Array.isArray(tc.tree)) return false
  if (
    !tc.tree.every((n: unknown) => {
      if (!_isObject(n) || typeof n.id !== 'string') return false
      if (!_isNonNegInt(n.level)) return false
      if (INFINITE_NODE_IDS.has(n.id) && n.level > MAX_INFINITE_NODE_LEVEL) return false
      return true
    })
  )
    return false

  // achievements（可选字段）：存在则校验结构；id 白名单在 hydrate 层过滤
  if (d.achievements !== undefined) {
    if (!_isObject(d.achievements)) return false
    const ach = d.achievements as Record<string, unknown>
    if (!_isObject(ach.lifetime)) return false
    const lt = ach.lifetime as Record<string, unknown>
    for (const k of ['energy', 'dark']) {
      if (typeof lt[k] !== 'string' || !_isNonNegNumberStr(lt[k])) return false
    }
    for (const k of ['upgrades', 'maxBuildingLevel', 'researches', 'explores', 'battles']) {
      if (!_isNonNegFinite(lt[k])) return false
    }
    if (!_isObject(ach.unlocked)) return false
    for (const v of Object.values(ach.unlocked as Record<string, unknown>)) {
      if (!_isNonNegFinite(v)) return false
    }
    // v1.22 新两键存在才验（旧档缺键视为 0，兼容不拒档；v1.21 周挑战同口径）
    for (const k of ['synths', 'enhanceLevels']) {
      const v = (lt as Record<string, unknown>)[k]
      if (v !== undefined && !_isNonNegFinite(v)) return false
    }
  }

  // daily（可选字段）：结构校验。挑战条目的 kind/target/rewardDark 不可信存档值，
  // 由 hydrate 按模板池 + tier 重推导（防伪造 target:0 白领奖励）
  if (d.daily !== undefined) {
    if (!_isObject(d.daily)) return false
    const dl = d.daily as Record<string, unknown>
    if (typeof dl.lastCheckIn !== 'string') return false
    if (!_isNonNegFinite(dl.streak)) return false
    if (!_isObject(dl.weeklyCounters)) return false
    const wc = dl.weeklyCounters as Record<string, unknown>
    // 基础五键必验；v1.21 新四键存在才验（旧档缺键视为 0，兼容不拒档）
    for (const k of ['battles', 'explores', 'researches', 'upgrades', 'transcends']) {
      if (!_isNonNegFinite(wc[k])) return false
    }
    for (const k of ['expedition', 'synths', 'enhances', 'garrisonHours']) {
      if (wc[k] !== undefined && !_isNonNegFinite(wc[k])) return false
    }
    if (typeof dl.challengeWeek !== 'string') return false
    if (!Array.isArray(dl.weekChallenges)) return false
    for (const c of dl.weekChallenges) {
      if (!_isObject(c)) return false
      if (typeof c.templateId !== 'string') return false
      if (!_isNonNegFinite(c.tier)) return false
      if (!_isBool(c.claimed)) return false
    }
    // weeklyBoss（v1.24 可选）：存在则须为对象且 claimedWeek 为字符串
    // （「是否本周」由读取侧按当前周比较，存档值本身不判真伪）
    if (dl.weeklyBoss !== undefined) {
      if (!_isObject(dl.weeklyBoss)) return false
      if (typeof (dl.weeklyBoss as Record<string, unknown>).claimedWeek !== 'string') return false
    }
  }
  // archive（可选字段）：存在则校验结构；未知键已在 _validateAndRepair 剥离
  if (d.archive !== undefined) {
    if (!_isObject(d.archive)) return false
    const arc = d.archive as Record<string, unknown>
    if (!Array.isArray(arc.enemies)) return false
    if (!arc.enemies.every((k: unknown) => typeof k === 'string')) return false
  }
  // encounters（v1.26 可选字段）：存在则校验结构。挂起事件 id 白名单校验在
  // _validateAndRepair 剥离后到达此处（未知 id 只损失挂起，不拒整档）；
  // 时间戳非负有限（过期判定与窗口比较都在读取侧，存档值本身不判真伪）
  if (d.encounters !== undefined) {
    if (!_isObject(d.encounters)) return false
    const enc = d.encounters as Record<string, unknown>
    if (!_isNonNegFinite(enc.nextTriggerAt)) return false
    if (enc.pendingEventId !== undefined && typeof enc.pendingEventId !== 'string') return false
    if (enc.pendingAt !== undefined && !_isNonNegFinite(enc.pendingAt)) return false
  }
  return true
}

function _isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 检查值是非负有限数字字符串（如 "100"、"3.14"、"1e+61"）——
 * 白名单形态判定：空串/空白/Infinity/NaN/负数/前导符号一律拒绝
 * （此前用 Number(v) 判定，Number('')===0 会放行空串，deser 时抛 DecimalError）。
 * 指数位数限 1~6 位（v0.81 收口）：不限位时 "1e999…" 可绕过校验构造 Infinity，
 * ser(Infinity) 写出 "Infinity" 后下一轮读档被本正则拒绝 → 整档判废；
 * 6 位上限覆盖到 1e999999（绝对值远超游戏任意数值），正常存档零影响
 */
function _isNonNegNumberStr(v: unknown): boolean {
  return typeof v === 'string' && /^\d+(\.\d+)?([eE][+-]?\d{1,6})?$/.test(v)
}

function _isNonNegNumberStrRecord(v: unknown): boolean {
  if (!_isObject(v)) return false
  for (const val of Object.values(v)) {
    if (!_isNonNegNumberStr(val)) return false
  }
  return true
}

/** 非负有限数字判定（存档数值字段的最常用约束，v1.03 收敛多处展开写法） */
function _isNonNegFinite(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0
}

/** 非负整数判定（等级/次数类字段；isInteger 已含 number 与有限约束） */
function _isNonNegInt(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0
}

/** 布尔判定（存档布尔字段） */
function _isBool(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

/** 字符串数组白名单判定（completed 类 id 列表，v1.03） */
function _isValidStrArray(v: unknown, ids: Set<string>): boolean {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && ids.has(x))
}

/** 检查 Record 的 key 在有效 ID 集合内，value 为非负数字（intOnly=true 时还需整数） */
function _isValidIdNumberRecord(v: unknown, validIds: Set<string>, intOnly: boolean): boolean {
  if (!_isObject(v)) return false
  for (const [key, val] of Object.entries(v)) {
    if (!validIds.has(key)) return false
    if (!_isNonNegFinite(val)) return false
    if (intOnly && !Number.isInteger(val)) return false
  }
  return true
}
