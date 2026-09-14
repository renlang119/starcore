/**
 * game.ts — 主游戏 store
 * 统筹 tick 循环、存档、离线收益、转生协调
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { D, Decimal, add } from '@/lib/decimal'
import { EffectSystem, type EffectSource } from '@/lib/effect-system'
import { computeOfflineGains as calcOfflineGains, type OfflineReport } from '@/lib/offline-gains'
import { useResourcesStore, START_ENERGY } from './resources'
import { useBuildingsStore } from './buildings'
import { useResearchStore } from './research'
import { useMilitaryStore, setTrainingSlotProvider, MAX_TRAINING_SLOTS } from './military'
import { useCombatStore, setGarrisonGuard } from './combat'
import { useExplorationStore } from './exploration'
import { useRelicsStore, setRelicSlotProvider, setRelicEnhanceSpendProvider } from './relics'
import { useTranscendStore } from './transcend'
import { useAchievementsStore, setAchievementExternalProviders } from './achievements'
import { useDailyStore } from './daily'
import {
  readSave,
  writeSave,
  writeSaveSync,
  clearSave,
  exportSave,
  importSave,
  SAVE_VERSION,
  type SaveData,
} from '@/lib/storage'
import { TECHS, adjustedTechCost } from '@/data/tech'
import { BUILDINGS } from '@/data/buildings'
import { getStronghold } from '@/data/pve'
import type { ResourceType } from '@/data/buildings'

const TICK_INTERVAL = 1000 // ms
// 后台 tick 补算后，仅当离线时长超过此阈值才弹窗展示报告；
// 低于阈值时静默补算资源/训练进度，避免浏览器对不活跃标签页 setInterval
// 节流导致的短时 dt>60 误弹"离线收益报告"。
const OFFLINE_REPORT_THRESHOLD = 300 // 秒（5 分钟）

export const useGameStore = defineStore('game', () => {
  const resources = useResourcesStore()
  const buildings = useBuildingsStore()
  const research = useResearchStore()
  const military = useMilitaryStore()
  const combat = useCombatStore()
  const exploration = useExplorationStore()
  const relics = useRelicsStore()
  const transcend = useTranscendStore()
  const achievements = useAchievementsStore()
  const daily = useDailyStore()

  // 修复：显式注入槽位扩展依赖，避免 relics store setup 阶段隐式引用 transcend
  setRelicSlotProvider(() => transcend.getValue('relic_slot'))
  // 强化能量支出通道（v0.70）：接入 resources.spend 原子扣费
  setRelicEnhanceSpendProvider((cost) => resources.spend('energy', cost))
  // 成就的外部现值指标（遗物/转生数本身跨转生保留，无需终身计数）
  setAchievementExternalProviders({
    relicsOwned: () => relics.ownedCount,
    relicKinds: () => relics.ownedKinds,
    transcends: () => transcend.totalTranscends,
    playtime: () => totalPlayTime.value,
    expeditionBest: () => combat.expeditionBest,
  })
  // 训练并行槽：基础 1 槽 + 科技加成（集群操练 I/II 各 +1），封顶 MAX_TRAINING_SLOTS
  setTrainingSlotProvider(() =>
    Math.min(MAX_TRAINING_SLOTS, 1 + effectSystem.getValue('training_slot'))
  )
  // 驻扎前置守卫（v0.82 驻扎校验）：据点须解锁（探索前置完成）+ 编队存在且未被其他据点占用。
  // 据点已攻克门槛由 combat.garrison 本体校验（completedStrongholds 属 combat 自身状态）
  setGarrisonGuard((strongholdId, formationId) => {
    const def = getStronghold(strongholdId)
    if (!def) return false
    if (def.requires && !exploration.isCompleted(def.requires)) return false
    const f = military.formations.find((f) => f.id === formationId)
    if (!f) return false
    for (const [sid, g] of Object.entries(combat.garrisoned)) {
      if (sid !== strongholdId && g.formationId === formationId) return false
    }
    return true
  })

  // —— game meta state ——
  const lastSaveTime = ref(Date.now())
  const lastTickTime = ref(Date.now())
  const isRunning = ref(false)
  const totalPlayTime = ref(0)
  const player = ref({ id: 'local', name: '指挥官' })
  const offlineReport = ref<OfflineReport | null>(null)
  /**
   * 初始化错误态（A2 兜底）：读档/hydrate 异常或存档版本过新时置位。
   * 置位后不启动 tick 与自动存档（保护原始存档不被空状态覆盖），
   * App 展示错误屏，由玩家选择导出原始存档或「清除存档重开」。
   * corrupt（v0.81）：主备档都存在但全部不可读——与「无档」严格区分，
   * 不静默开新档（旧路径 15 秒后自动存档会用空状态覆盖损坏档，造成数据丢失）。
   * corruptRaw 保存原始存档载荷，供错误屏「导出原始存档」。
   */
  const initError = ref<'too_new' | 'corrupt' | 'failed' | null>(null)
  const corruptRaw = ref<string | null>(null)

  // —— 统一效果系统（6.2：替代三处重复 getMax 逻辑）——
  const effectSystem = new EffectSystem()
  // 各 store 通过 getMult/getValue 接口注册为 EffectSource
  effectSystem.register(research as EffectSource)
  effectSystem.register(relics as EffectSource)
  effectSystem.register(transcend as EffectSource)
  effectSystem.register(achievements as EffectSource)

  // —— 计算全局乘数（5.1：改为 computed 缓存，仅在依赖变化时重算）——
  const productionMults = computed<Record<string, Decimal>>(() => {
    const result: Record<string, Decimal> = {}
    for (const res of ['energy', 'crystal', 'alloy', 'data', 'dark']) {
      result[res] = effectSystem.getMult('production_mult', res)
    }
    return result
  })

  const atkMult = computed(() => effectSystem.getMult('combat_mult', 'attack'))
  const defMult = computed(() => effectSystem.getMult('combat_mult', 'defense'))
  const exploreMult = computed(() => effectSystem.getMult('explore_mult'))
  const prestigeMult = computed(() => effectSystem.getMult('prestige_mult'))
  const offlineMult = computed(() => effectSystem.getMult('offline_bonus'))
  const techCostMult = computed(() => effectSystem.getMult('cost_mult', 'tech'))
  // —— 自动化 QoL 开关（v0.58，转生树买断节点；getValue 累加通道 > 0 即已购）——
  const autoBuild = computed(() => effectSystem.getValue('auto_build') > 0)
  const autoResearch = computed(() => effectSystem.getValue('auto_research') > 0)
  const autoExplore = computed(() => effectSystem.getValue('auto_explore') > 0)

  /** 5.2：缓存总产出——仅当建筑等级或乘数变化时重算 */
  const totalProduction = computed(() => buildings.getTotalProduction(productionMults.value))

  // —— 计算属性直接暴露（已移除冗余包装函数）——

  // —— 主 tick ——
  /**
   * 成就终身计数采集：totals 差值快照法。
   * resources.totals 记录本轮总产出（建筑 tick/探索奖励/战斗奖励/离线补算全部入 totals），
   * 每 tick 取与上次快照的差值计入终身计数——单点采集覆盖全部产出通道。
   * 转生会重置 totals（差值为负 → 钳 0）；hydrate/hardReset 时快照显式对齐。
   */
  const lifetimeTotalsSnapshot = { energy: D(0), dark: D(0) }
  function collectLifetimeTotals(): void {
    const curEnergy = resources.getTotal('energy')
    const curDark = resources.getTotal('dark')
    const dEnergy = curEnergy.minus(lifetimeTotalsSnapshot.energy)
    const dDark = curDark.minus(lifetimeTotalsSnapshot.dark)
    if (dEnergy.gt(0)) achievements.addEnergy(dEnergy)
    if (dDark.gt(0)) achievements.addDark(dDark)
    lifetimeTotalsSnapshot.energy = curEnergy
    lifetimeTotalsSnapshot.dark = curDark
  }

  // —— 每日签到/周期挑战（v0.62）——
  /** 挑战奖励发放（DailyCard 领取按钮回调） */
  function claimChallenge(templateId: string): { dark: number; streakBonus: number } | null {
    const result = daily.claim(templateId)
    if (!result) return null
    resources.gain('dark', result.dark)
    return result
  }

  function tick() {
    const now = Date.now()
    let dt = (now - lastTickTime.value) / 1000
    lastTickTime.value = now
    // 非有限守卫（NaN/Infinity）与负值统一按 1 秒处理：NaN <= 0 为
    // false 会穿透，随后 dt > 60 同样为 false，NaN 会流进产出与训练推进
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 // 异常保护
    if (dt > 60) {
      // 标签页后台过久：补算离线收益，本次 tick 只算 1 秒
      const report = doComputeOfflineGains(dt)
      // 短时离线（<5分钟）静默补算不弹窗——浏览器对不活跃标签页的
      // setInterval 有节流（常降至 1 次/分钟甚至更低），或系统短暂
      // 休眠唤醒，都会导致 dt 突然超过 60 秒。这种情况下玩家并未真正
      // "离开"，弹窗打扰体验。补算逻辑照常执行，仅抑制弹窗。
      if (report && dt >= OFFLINE_REPORT_THRESHOLD) setOfflineReport(report)
      dt = 1
    }
    totalPlayTime.value += dt

    // 1. 计算产出（5.2：使用 cached computed，避免每 tick 全量遍历建筑）
    const totalProd = totalProduction.value
    for (const [res, v] of Object.entries(totalProd)) {
      resources.setProduction(res as ResourceType, v)
    }
    // 驻扎挂机收益（使用 computed 缓存，仅在 garrisoned 变化时重算）
    const garrisonProd = combat.garrisonProduction
    for (const [res, v] of Object.entries(garrisonProd)) {
      resources.setProduction(
        res as ResourceType,
        add(resources.getRate(res as ResourceType), D(v))
      )
    }
    // 2. 资源增长
    resources.applyTick(dt)

    // 2.5 自动化 QoL（v0.58）：建造协议/研究协议/探索协议，买断常开只在线生效。
    // 复用既有原子操作（tryUpgradeBuilding/tryResearch/startExplore），
    // 成就钩子、科技成本乘数、并发口径与手动路径天然一致。
    if (autoBuild.value || autoResearch.value || autoExplore.value) {
      runAutomation()
    }

    // 3. 训练队列
    military.applyTick(dt)

    // 4. 探索进度
    const exploreResults = exploration.applyTick()
    for (const r of exploreResults) {
      // 发放探索奖励
      for (const [res, v] of Object.entries(r.rewards)) {
        resources.gain(res as ResourceType, v as number)
      }
      achievements.recordExplore()
      daily.bump('explores')
    }

    // 5. 成就：终身计数采集 + 解锁判定（37 条全表扫描，每秒一次开销可忽略）
    // playtime 指标直接读 totalPlayTime 现值（转生不清、hardReset 才清），无需单独累计
    collectLifetimeTotals()
    achievements.checkAndUnlock()

    // 6. 每日签到/周期挑战（v0.62）：换天自动签到 + 换周重掷（字符串比对，开销忽略）
    const checkIn = daily.onTickCheckIn()
    if (checkIn) {
      for (const [res, v] of Object.entries(checkIn)) {
        if (res !== 'streakDay' && res !== 'returned' && v) {
          resources.gain(res as ResourceType, v as number)
        }
      }
    }
  }

  /**
   * 自动化 QoL（v0.58）：每 tick 一遍，三种协议独立开关。
   * - 建造协议：按 BUILDINGS 数据序扫描已解锁建筑，买得起即升 1 级（每建筑每 tick 至多 1 级）
   * - 研究协议：按 TECHS 数据序扫描可用科技，买得起即完成（含 techCostMult，与手动一致）
   * - 探索协议：availableNodes 已挡完成/进行中/前置，逐个尝试开始（与 MapView 手动同路径）
   * 购买策略 = 买得起即买，不留储备。单遍扫描 20 建筑/59 科技/34 节点，开销可忽略。
   */
  function runAutomation(): void {
    if (autoBuild.value) {
      for (const b of BUILDINGS) {
        // isUnlocked 查 b.requires（科技 id），须传已完成科技集合；
        // 传 unlockedSet（unlock 效果目标=建筑 id）两集合永不相交，17/20 建筑永不自动升级
        if (!buildings.isUnlocked(b, research.completed)) continue
        tryUpgradeBuilding(b.id)
      }
    }
    if (autoResearch.value) {
      for (const def of TECHS) {
        if (!research.available(def)) continue
        tryResearch(def.id)
      }
    }
    if (autoExplore.value) {
      for (const node of exploration.availableNodes()) {
        exploration.startExplore(
          node.id,
          exploreMult.value,
          (c) => resources.canAfford(c),
          (c) => resources.spendCost(c)
        )
      }
    }
  }
  // —— 自动存档 ——
  let saveTimer: ReturnType<typeof setInterval> | null = null
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let visibilityHandler: (() => void) | null = null

  function start() {
    if (isRunning.value) return
    isRunning.value = true
    // 首帧保证：新档/重置后立即生成当周挑战（已存在则幂等），
    // 避免「本周挑战」区在首个 tick 前约 1 秒的空窗
    daily.ensureWeek()
    lastTickTime.value = Date.now()
    tickTimer = setInterval(tick, TICK_INTERVAL)
    saveTimer = setInterval(save, 15000) // 每 15 秒自动存档（缩短间隔降低丢失量）
    // 标签页回到前台时立即触发一次 tick，补算后台期间的进度
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }
  function stop() {
    isRunning.value = false
    if (tickTimer) clearInterval(tickTimer)
    if (saveTimer) clearInterval(saveTimer)
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
    tickTimer = null
    saveTimer = null
    visibilityHandler = null
  }

  // —— 存档 ——
  function buildSaveData(): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      player: { ...player.value },
      totalPlayTime: totalPlayTime.value,
      resources: resources.serialize(),
      buildings: buildings.serialize(),
      research: research.serialize(),
      military: military.serialize(),
      combat: combat.serialize(),
      exploration: exploration.serialize(),
      relics: relics.serialize(),
      transcend: transcend.serialize(),
      achievements: achievements.serialize(),
      daily: daily.serialize(),
    }
  }

  // —— 存档（错误态守卫：initError 置位时拒绝一切写入，防空状态覆盖原始存档）——
  /**
   * 存档写入失败标志：双通道全失败（配额/隐私模式）时置位，由全局提示层
   * 给玩家可见反馈；下次成功保存自动清除。避免整段进度只在内存而玩家不知情。
   */
  const saveFailed = ref(false)
  async function save(): Promise<boolean> {
    if (initError.value) return false
    const ok = await writeSave(buildSaveData())
    if (ok) {
      lastSaveTime.value = Date.now()
      saveFailed.value = false
    } else {
      saveFailed.value = true
    }
    return ok
  }

  /** 同步存档（仅 localStorage），用于 beforeunload 场景 */
  function saveSync(): void {
    if (initError.value) return
    const ok = writeSaveSync(buildSaveData())
    if (ok) {
      lastSaveTime.value = Date.now()
      saveFailed.value = false
    } else {
      saveFailed.value = true
    }
  }

  async function load(): Promise<boolean> {
    try {
      const outcome = await readSave()
      if (outcome.status === 'too_new') {
        // 版本过新：不静默 hydrate 未知结构，进入错误态等玩家处理
        initError.value = 'too_new'
        return false
      }
      if (outcome.status === 'corrupt') {
        // 主备档都在但都不可读（v0.81）：进错误屏给导出/清除出口，
        // 绝不按无档处理——否则 15 秒自动存档会用空状态覆盖损坏档
        initError.value = 'corrupt'
        corruptRaw.value = outcome.raw ?? null
        return false
      }
      if (outcome.status === 'none') return false
      hydrateAll(outcome.data)
      return true
    } catch {
      // 读档/hydrate 异常（数据损坏/解析失败）：进入错误态，不启动游戏循环
      initError.value = 'failed'
      return false
    }
  }

  function hydrateAll(data: SaveData) {
    if (data.player) player.value = { ...player.value, ...data.player }
    // 恢复上次保存时间，否则 computeOfflineGains 会因 elapsed≈0 直接 return null
    if (data.savedAt) lastSaveTime.value = data.savedAt
    // 终身游玩时长入档（旧档缺失保持 0）
    if (
      typeof data.totalPlayTime === 'number' &&
      isFinite(data.totalPlayTime) &&
      data.totalPlayTime >= 0
    ) {
      totalPlayTime.value = data.totalPlayTime
    }
    resources.hydrate(data.resources)
    buildings.hydrate(data.buildings)
    research.hydrate(data.research)
    military.hydrate(data.military)
    combat.hydrate(data.combat)
    exploration.hydrate(data.exploration)
    transcend.hydrate(data.transcend)
    relics.hydrate(data.relics)
    achievements.hydrate(data.achievements)
    daily.hydrate(data.daily)
    // 终身计数快照对齐已恢复的 totals——否则首个 tick 会把整轮历史产量
    // 当作增量重复计入终身计数
    lifetimeTotalsSnapshot.energy = resources.getTotal('energy')
    lifetimeTotalsSnapshot.dark = resources.getTotal('dark')
  }

  // —— 离线收益 ——
  function doComputeOfflineGains(elapsedOverride?: number): OfflineReport | null {
    const now = Date.now()
    const elapsed = elapsedOverride ?? (now - lastSaveTime.value) / 1000
    // 非有限守卫：NaN/Infinity 不做离线补算（lib 层同样自守，此处提前
    // 拦截避免 lastSaveTime 被推进后返回 null 报告的语义混淆）
    if (!Number.isFinite(elapsed) || elapsed < 60) return null
    // 防止重复计算：将 lastSaveTime 推进到当前时刻（无论是否有 elapsedOverride）
    lastSaveTime.value = now
    return calcOfflineGains(elapsed, {
      totalProduction: totalProduction.value,
      offlineMult: offlineMult.value,
      garrisoned: combat.garrisoned,
      garrisonIdleReward: combat.garrisonIdleReward.bind(combat),
      gainResource: (res, amount) => resources.gain(res, amount),
      advanceTraining: (duration) => military.applyTick(duration),
    })
  }

  function setOfflineReport(r: OfflineReport | null) {
    offlineReport.value = r
  }

  async function init(): Promise<boolean> {
    const loaded = await load()
    // 错误态：不启动 tick 与自动存档，等待玩家在错误屏选择清档重开
    if (initError.value) return false
    if (loaded) {
      const report = doComputeOfflineGains()
      setOfflineReport(report)
    }
    lastTickTime.value = Date.now()
    start()
    return loaded
  }

  // —— 导出 / 导入 ——
  async function doExport(): Promise<string> {
    return exportSave(buildSaveData())
  }
  /** 错误屏「导出原始存档」：把损坏档的原始载荷原样交出（不解析不改写） */
  function exportCorruptRaw(): string {
    return corruptRaw.value ?? ''
  }
  async function doImport(code: string): Promise<{ success: boolean; message?: string }> {
    const result = await importSave(code)
    if (!result.ok) {
      const msg =
        result.reason === 'corrupted'
          ? '存档数据已损坏或被篡改'
          : result.reason === 'too_new'
            ? '存档来自更新的游戏版本，无法导入'
            : '存档无效或已损坏'
      return { success: false, message: msg }
    }
    try {
      // 导入 = 替换语义（v0.81）：hydrate 各 store 只覆盖出现的键，
      // 不先 reset 的话导入档缺省字段会保留会话现值（totalTranscends=0 也无法清零）。
      // 重置清单对齐 hardReset（resources.reset() 回到含初始能量的新档状态；
      // combat 传 fullReset 清远征深度），但不清存档、不停游戏循环；
      // reset 后由 hydrateAll 恢复导入档快照，终身计数不重复计入
      resources.reset()
      buildings.reset()
      research.reset()
      military.reset()
      combat.reset(true)
      exploration.reset()
      relics.reset()
      transcend.reset(true)
      achievements.reset()
      daily.reset()
      totalPlayTime.value = 0
      hydrateAll(result.data)
      await save()
      return { success: true }
    } catch {
      // hydrate 异常兜底：不再裸抛中断导入流程
      return { success: false, message: '存档数据异常，导入失败' }
    }
  }

  async function hardReset() {
    stop()
    await clearSave()
    initError.value = null
    corruptRaw.value = null
    resources.reset()
    buildings.reset()
    research.reset()
    military.reset()
    combat.reset(true) // hardReset 连远征深度一并清零
    exploration.reset()
    relics.reset()
    transcend.reset(true)
    achievements.reset()
    daily.reset()
    lifetimeTotalsSnapshot.energy = D(0)
    lifetimeTotalsSnapshot.dark = D(0)
    offlineReport.value = null
    totalPlayTime.value = 0
    // 给初始资源
    resources.setAmount('energy', START_ENERGY)
    start()
  }

  // —— 转生 ——
  function canTranscend(): boolean {
    const totalEnergy = resources.getTotal('energy')
    const preview = transcend.previewNegEntropy(totalEnergy, prestigeMult.value)
    return preview.gte(1)
  }
  function previewTranscendGain(): Decimal {
    return transcend.previewNegEntropy(resources.getTotal('energy'), prestigeMult.value)
  }
  /**
   * 执行转生（奇点重启）
   *
   * 3.14 设计意图说明：
   * 转生后 resources.reset(true) 会重置 totals（历史总产出）为 0。
   * 这是设计意图而非 bug——放置类游戏的标准循环：
   *   每轮 run 积累能量 → 获得负熵 → 转生重置 → 新一轮 run
   * 如果 totals 不重置，玩家在后续 run 中无需任何努力即可获得大量负熵，
   * 破坏游戏平衡。previewNegEntropy 基于 getTotal('energy') 计算，
   * 重置后需要重新积累到 3e5 才能再次转生，符合预期。
   */
  function doTranscend(): boolean {
    const gain = previewTranscendGain()
    if (gain.lt(1)) return false
    // 成就终身计数：转生前先把本轮未采集的 totals 增量收进终身计数，
    // 再把快照归零对齐 reset 后的 totals（否则差值为负被钳掉，白丢一段计数）
    collectLifetimeTotals()
    lifetimeTotalsSnapshot.energy = D(0)
    lifetimeTotalsSnapshot.dark = D(0)
    // 执行转生
    transcend.transcend(gain)
    daily.bump('transcends')
    // 重置非保留项
    resources.reset(true) // 保留暗物质
    buildings.reset()
    research.reset()
    military.reset()
    combat.reset() // 转生清驻扎/本轮通关，远征深度跨转生保留
    exploration.reset()
    // relics 保留
    // transcend 保留
    // 初始能量加成
    const startingMult = transcend.getValue('starting_energy')
    if (startingMult > 0) {
      resources.setAmount('energy', START_ENERGY * startingMult)
    }
    // 转生次数类成就即时判定（不等下一个 tick）
    achievements.checkAndUnlock()
    return true
  }

  // —— 3.12：原子操作（check + spend + execute 一体化，消除竞态）——
  /**
   * 尝试升级建筑：原子检查资源 + 扣费 + 升级
   * 替代视图中 canAfford → spendCost → upgrade 的三步非原子调用
   */
  function tryUpgradeBuilding(id: string): boolean {
    const def = BUILDINGS.find((b) => b.id === id)
    if (!def) return false // 未知建筑 id：失败路径不记账不扣费
    const cost = buildings.getCost(id)
    if (!resources.spendCost(cost)) return false // spendCost 内部已含 canAfford 检查
    buildings.upgrade(id)
    achievements.recordUpgrade(buildings.getLevel(id))
    daily.bump('upgrades')
    return true
  }

  /**
   * 批量升级建筑（v0.86）：至多 steps 级、买满语义。
   * 内部逐级复用 tryUpgradeBuilding 原子操作，等级/成就/周挑战记账
   * 粒度与连点完全一致；买不起下一级或已满级自然停止。
   */
  function tryUpgradeBuildingSteps(id: string, steps: number): number {
    let done = 0
    for (let i = 0; i < steps; i++) {
      if (!tryUpgradeBuilding(id)) break
      done++
    }
    return done
  }

  /**
   * 尝试研究科技：原子检查资源 + 扣费 + 完成
   */
  function tryResearch(id: string): boolean {
    const def = TECHS.find((t) => t.id === id)
    if (!def) return false
    const adjustedCost = adjustedTechCost(def.cost, techCostMult.value.toNumber())
    if (!research.available(def)) return false
    if (!resources.spendCost(adjustedCost)) return false
    research.complete(id)
    achievements.recordResearch()
    daily.bump('researches')
    return true
  }

  return {
    // sub-stores (directly accessible)
    resources,
    buildings,
    research,
    military,
    combat,
    exploration,
    relics,
    transcend,
    achievements,
    daily,
    claimChallenge,
    // meta
    lastSaveTime,
    lastTickTime, // 上次 tick 时间戳（测试用于模拟时间推进）
    isRunning,
    totalPlayTime,
    player,
    offlineReport,
    initError,
    // computed（直接暴露，无需包装函数）
    productionMults,
    atkMult,
    defMult,
    exploreMult,
    prestigeMult,
    offlineMult,
    techCostMult,
    autoBuild,
    autoResearch,
    autoExplore,
    // lifecycle
    tick,
    start,
    stop,
    init,
    save,
    saveSync,
    saveFailed,
    load,
    hardReset,
    // offline
    computeOfflineGains: doComputeOfflineGains,
    setOfflineReport,
    // import/export
    doExport,
    doImport,
    corruptRaw,
    exportCorruptRaw,
    // atomic actions (3.12)
    tryUpgradeBuilding,
    tryUpgradeBuildingSteps,
    tryResearch,
    // transcend
    canTranscend,
    previewTranscendGain,
    doTranscend,
  }
})
