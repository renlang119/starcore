/**
 * game.ts — 主游戏 store
 * 统筹 tick 循环、存档、离线收益、转生协调
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { D, Decimal, add } from '@/lib/decimal'
import { EffectSystem, type EffectSource } from '@/lib/effect-system'
import { computeOfflineGains as calcOfflineGains, type OfflineReport } from '@/lib/offline-gains'
import { migrateSave } from '@/lib/save-migrate'
import { useResourcesStore } from './resources'
import { useBuildingsStore } from './buildings'
import { useResearchStore } from './research'
import { useMilitaryStore, setTrainingSlotProvider, MAX_TRAINING_SLOTS } from './military'
import { useCombatStore } from './combat'
import { useExplorationStore } from './exploration'
import { useRelicsStore, setRelicSlotProvider } from './relics'
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
  type SaveData,
} from '@/lib/storage'
import { TECHS } from '@/data/tech'
import { BUILDINGS } from '@/data/buildings'
import type { ResourceType } from '@/data/buildings'

const SAVE_VERSION = 7
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

  // 显式注入槽位扩展依赖，避免 relics store setup 阶段隐式引用 transcend
  setRelicSlotProvider(() => transcend.getValue('relic_slot'))
  // 成就的外部现值指标（遗物/转生数本身跨转生保留，无需终身计数）
  setAchievementExternalProviders({
    relicsOwned: () => relics.ownedCount,
    relicKinds: () => relics.ownedKinds,
    transcends: () => transcend.totalTranscends,
    playtime: () => totalPlayTime.value,
  })
  // 训练并行槽：基础 1 槽 + 科技加成（集群操练 I/II 各 +1），封顶 MAX_TRAINING_SLOTS
  setTrainingSlotProvider(() =>
    Math.min(MAX_TRAINING_SLOTS, 1 + effectSystem.getValue('training_slot'))
  )

  // —— game meta state ——
  const lastSaveTime = ref(Date.now())
  const lastTickTime = ref(Date.now())
  const isRunning = ref(false)
  const totalPlayTime = ref(0)
  const player = ref({ id: 'local', name: '指挥官' })
  const offlineReport = ref<OfflineReport | null>(null)

  // —— 统一效果系统（6.2：替代三处重复 getMax 逻辑）——
  const effectSystem = new EffectSystem()
  // 各 store 通过 getMult/getValue 接口注册为 EffectSource
  effectSystem.register(research as EffectSource)
  effectSystem.register(relics as EffectSource)
  effectSystem.register(transcend as EffectSource)
  effectSystem.register(achievements as EffectSource)

  // —— 计算全局乘数（5.1：改为 computed 缓存，仅在依赖变化时重算）——
  const productionMults = computed<Record<string, Decimal>>(() => {
    const result: Record<string, Decimal> = {
      energy: D(1),
      crystal: D(1),
      alloy: D(1),
      data: D(1),
      dark: D(1),
    }
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
  /** 签到结果浮层（AppShell/DailyCard 消费后清除） */
  const dailyToast = ref<{ text: string; at: number } | null>(null)
  function setDailyToast(info: {
    energy: number
    dark: number
    streakDay: number
    returned: boolean
  }): void {
    const parts = [`+${info.energy} 能量`]
    if (info.dark > 0) parts.push(`+${info.dark} 暗物质`)
    const prefix = info.returned
      ? `回归补偿 · 连击 ${info.streakDay} 天`
      : `每日签到 · 连击 ${info.streakDay} 天`
    dailyToast.value = { text: `${prefix}（${parts.join(' ')}）`, at: Date.now() }
  }
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
    if (dt <= 0) dt = 1 // 异常保护
    if (dt > 60) {
      // 标签页后台过久：补算离线收益，本次 tick 只算 1 秒
      const report = doComputeOfflineGains(dt)
      // 短时离线（<5分钟）静默补算不弹窗——浏览器对不活跃标签页的
      // setInterval 有节流（常降至 1 次/分钟甚至更低），或系统短暂
      // 休眠唤醒，都会导致 dt 突然超过 60 秒。这种情况下用户并未真正
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
    const exploreResults = exploration.applyTick(exploreMult.value)
    for (const r of exploreResults) {
      // 发放探索奖励
      for (const [res, v] of Object.entries(r.rewards)) {
        resources.gain(res as ResourceType, v as number)
      }
      achievements.recordExplore()
      daily.bump('explores')
    }

    // 5. 成就：终身计数采集 + 解锁判定（31 条全表扫描，每秒一次开销可忽略）
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
      setDailyToast(checkIn)
    }
  }

  /**
   * 自动化 QoL（v0.58）：每 tick 一遍，三种协议独立开关。
   * - 建造协议：按 BUILDINGS 数据序扫描已解锁建筑，买得起即升 1 级（每建筑每 tick 至多 1 级）
   * - 研究协议：按 TECHS 数据序扫描可用科技，买得起即完成（含 techCostMult，与手动一致）
   * - 探索协议：availableNodes 已挡完成/进行中/前置，逐个尝试开始（与 MapView 手动同路径）
   * 购买策略 = 买得起即买，不留储备。单遍扫描 20 建筑/43 科技/10 节点，开销可忽略。
   */
  function runAutomation(): void {
    if (autoBuild.value) {
      for (const b of BUILDINGS) {
        if (!buildings.isUnlocked(b, research.unlockedSet)) continue
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

  async function save(): Promise<void> {
    lastSaveTime.value = Date.now()
    await writeSave(buildSaveData())
  }

  /** 同步存档（仅 localStorage），用于 beforeunload 场景 */
  function saveSync(): void {
    lastSaveTime.value = Date.now()
    writeSaveSync(buildSaveData())
  }

  async function load(): Promise<boolean> {
    const data = await readSave()
    if (!data) return false
    hydrateAll(data)
    return true
  }

  function hydrateAll(data: SaveData) {
    // 存档版本迁移——确保向后兼容
    migrateSave(data, SAVE_VERSION)
    if (data.player) player.value = { ...player.value, ...data.player }
    // 恢复上次保存时间，否则 computeOfflineGains 会因 elapsed≈0 直接 return null
    if (data.savedAt) lastSaveTime.value = data.savedAt
    // v7 起终身游玩时长入档；旧档缺失保持 0
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
    if (elapsed < 60) return null
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
  async function doImport(code: string): Promise<{ success: boolean; message?: string }> {
    const result = await importSave(code)
    if (!result.ok) {
      const msg = result.reason === 'corrupted' ? '存档数据已损坏或被篡改' : '存档无效或已损坏'
      return { success: false, message: msg }
    }
    hydrateAll(result.data)
    await save()
    return { success: true }
  }

  async function hardReset() {
    stop()
    await clearSave()
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
    resources.setAmount('energy', 50)
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
      resources.setAmount('energy', 50 * startingMult)
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
    const cost = buildings.getCost(id)
    if (!resources.spendCost(cost)) return false // spendCost 内部已含 canAfford 检查
    buildings.upgrade(id)
    achievements.recordUpgrade(buildings.getLevel(id))
    daily.bump('upgrades')
    return true
  }

  /**
   * 尝试研究科技：原子检查资源 + 扣费 + 完成
   */
  function tryResearch(id: string): boolean {
    const def = TECHS.find((t) => t.id === id)
    if (!def) return false
    const mult = techCostMult.value.toNumber()
    const adjustedCost: Record<string, number> = {}
    for (const [k, v] of Object.entries(def.cost)) adjustedCost[k] = Math.ceil((v as number) * mult)
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
    isRunning,
    totalPlayTime,
    player,
    offlineReport,
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
    load,
    hardReset,
    // offline
    computeOfflineGains: doComputeOfflineGains,
    setOfflineReport,
    // import/export
    doExport,
    doImport,
    // atomic actions (3.12)
    tryUpgradeBuilding,
    tryResearch,
    // transcend
    canTranscend,
    previewTranscendGain,
    doTranscend,
  }
})
