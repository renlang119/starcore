/**
 * game.ts — 主游戏 store
 * 统筹 tick 循环、转生协调与跨 store 编排；
 * 效果系统见 game-effects，存档簇见 game-persistence
 */
import { t } from '@/i18n'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { D, add, type Decimal } from '@/lib/decimal'
import { repeatUntilFail, simulateSteps } from '@/lib/batch'
import { useResourcesStore, START_ENERGY } from './resources'
import { useBuildingsStore } from './buildings'
import { useResearchStore } from './research'
import { useMilitaryStore } from './military'
import { useCombatStore } from './combat'
import { useExplorationStore } from './exploration'
import { useRelicsStore } from './relics'
import { useTranscendStore } from './transcend'
import { useAchievementsStore } from './achievements'
import { useDailyStore } from './daily'
import { createGameEffects, wireGameProviders } from './game-effects'
import { createGamePersistence } from './game-persistence'
import { TECHS, adjustedTechCost } from '@/data/tech'
import { BUILDINGS, buildingCost } from '@/data/buildings'
import { enhanceCost, MAX_RELIC_LEVEL } from '@/data/relics'
import type { ResourceType } from '@/data/buildings'
import type { OfflineReport } from '@/lib/offline-gains'

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

  // —— game meta state ——
  const lastSaveTime = ref(Date.now())
  const lastTickTime = ref(Date.now())
  const isRunning = ref(false)
  const totalPlayTime = ref(0)
  const player = ref({ id: 'local', name: t('game.commander') })
  const offlineReport = ref<OfflineReport | null>(null)
  /**
   * 初始化错误态（A2 兜底）：读档/hydrate 异常或存档版本过新时置位。
   * 置位后不启动 tick 与自动存档（保护原始存档不被空状态覆盖），
   * App 展示错误屏，由玩家选择导出原始存档或「清除存档重开」。
   * corrupt：主备档都存在但全部不可读——与「无档」严格区分，
   * 不静默开新档（旧路径 15 秒后自动存档会用空状态覆盖损坏档，造成数据丢失）。
   * corruptRaw 保存原始存档载荷，供错误屏「导出原始存档」。
   */
  const initError = ref<'too_new' | 'corrupt' | 'failed' | null>(null)
  const corruptRaw = ref<string | null>(null)
  /**
   * 存档写入失败标志：双通道全失败（配额/隐私模式）时置位，由全局提示层
   * 给玩家可见反馈；下次成功保存自动清除。避免整段进度只在内存而玩家不知情。
   */
  const saveFailed = ref(false)

  // —— 效果系统与全局乘数 ——
  const {
    effectSystem,
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
    totalProduction,
  } = createGameEffects({ research, relics, transcend, achievements, buildings })

  // 各 store 一次性依赖注入（槽位扩展 / 强化支出通道 / 成就外部指标 / 训练并行槽 / 驻扎前置守卫）
  wireGameProviders({
    effectSystem,
    resources,
    relics,
    transcend,
    combat,
    military,
    exploration,
    totalPlayTime,
  })

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

  /** 终身计数快照对齐：toZero 归零（转生/清档），否则对齐当前 totals 现值（hydrate 后） */
  function alignLifetimeSnapshot(toZero = false) {
    lifetimeTotalsSnapshot.energy = toZero ? D(0) : resources.getTotal('energy')
    lifetimeTotalsSnapshot.dark = toZero ? D(0) : resources.getTotal('dark')
  }

  // —— 存档簇（存档组装 / 读写通道 / hydrate / 导入导出 / 离线补算 / 清档重置）——
  const {
    save,
    saveSync,
    load,
    computeOfflineGains,
    setOfflineReport,
    doExport,
    exportCorruptRaw,
    doImport,
    hardReset,
  } = createGamePersistence({
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
    totalProduction,
    offlineMult,
    lastSaveTime,
    totalPlayTime,
    player,
    offlineReport,
    initError,
    corruptRaw,
    saveFailed,
    alignLifetimeSnapshot,
    stop,
    start,
  })

  // —— 每日签到/周期挑战 ——
  /** 挑战奖励发放（DailyCard 领取按钮回调） */
  function claimChallenge(templateId: string): { dark: number; streakBonus: number } | null {
    const result = daily.claim(templateId)
    if (!result) return null
    resources.gain('dark', result.dark)
    return result
  }

  // —— 主 tick ——
  function tick() {
    const now = Date.now()
    let dt = (now - lastTickTime.value) / 1000
    lastTickTime.value = now
    // 非有限守卫（NaN/Infinity）与负值统一按 1 秒处理：NaN <= 0 为
    // false 会穿透，随后 dt > 60 同样为 false，NaN 会流进产出与训练推进
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 // 异常保护
    if (dt > 60) {
      // 标签页后台过久：补算离线收益，本次 tick 只算 1 秒
      const report = computeOfflineGains(dt)
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

    // 2.5 自动化 QoL：建造协议/研究协议/探索协议，买断常开只在线生效。
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

    // 6. 每日签到/周期挑战：换天自动签到 + 换周重掷（字符串比对，开销忽略）
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
   * 自动化 QoL：每 tick 一遍，三种协议独立开关。
   * - 建造协议：按 BUILDINGS 数据序扫描已解锁建筑，买得起即升 1 级（每建筑每 tick 至多 1 级）
   * - 研究协议：按 TECHS 数据序扫描可用科技，买得起即完成（含 techCostMult，与手动一致）
   * - 探索协议：availableNodes 已挡完成/进行中/前置，逐个尝试开始（与 MapView 手动同路径）
   * 购买策略 = 买得起即买，不留储备。单遍扫描 20 建筑/59 科技/34 节点，开销可忽略。
   */
  function runAutomation(): void {
    if (autoBuild.value) {
      for (const b of BUILDINGS) {
        // isUnlocked 查 b.requires（科技 id），须传已完成科技集合；
        // 误传 unlock 效果目标派生的集合会使两集合永不相交，建筑永不自动升级
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

  async function init(): Promise<boolean> {
    const loaded = await load()
    // 错误态：不启动 tick 与自动存档，等待玩家在错误屏选择清档重开
    if (initError.value) return false
    if (loaded) {
      const report = computeOfflineGains()
      setOfflineReport(report)
    }
    start()
    return loaded
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
    alignLifetimeSnapshot(true)
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
    if (buildings.isMaxed(id)) return false // 已达等级上限：与视图/队列/预览共用同一门槛
    const cost = buildings.getCost(id)
    if (!resources.spendCost(cost)) return false // spendCost 内部已含 canAfford 检查
    buildings.upgrade(id)
    achievements.recordUpgrade(buildings.getLevel(id))
    daily.bump('upgrades')
    return true
  }

  /**
   * 批量升级预览：返回当前资源下点击一次批量升级的实际
   * 可买级数与逐级累计总花费。逐级取价与扣费模拟同 tryUpgradeBuilding
   * 的实扣顺序一致（资源不足或达等级上限自然停止，最多 steps 级），
   * 供 ×N>1 档位在成本行展示「可买级数 + 预计总花费」。
   */
  function previewUpgradeBuildingSteps(
    id: string,
    steps: number
  ): { count: number; cost: Record<string, number> } {
    const def = BUILDINGS.find((b) => b.id === id)
    if (!def || steps < 1) return { count: 0, cost: {} }
    return simulateSteps(
      steps,
      buildings.getLevel(id),
      (level) => buildingCost(def, level),
      { ...resources.amounts },
      (level) => !buildings.isMaxed(id, level)
    )
  }

  /**
   * 批量强化预览：返回当前能量下点击一次批量强化的实际可完成级数。
   * 逐级按新等级取价，能量不足或达 20 级上限自然停止，最多 steps 级；
   * 取价与扣费顺序同 relics.enhanceSteps，供按钮文案按实际级数显示。
   */
  function previewRelicEnhanceSteps(instanceId: string, steps: number): number {
    const relic = relics.owned.find((r) => r.instanceId === instanceId)
    if (!relic || steps < 1) return 0
    return simulateSteps(
      steps,
      relic.level,
      (level) => ({ energy: enhanceCost(relic.rarity, level + 1) }),
      { energy: resources.getAmount('energy') },
      (level) => level < MAX_RELIC_LEVEL
    ).count
  }

  /**
   * 批量升级建筑：至多 steps 级、买满语义。
   * 内部逐级复用 tryUpgradeBuilding 原子操作，等级/成就/周挑战记账
   * 粒度与连点完全一致；买不起下一级或已满级自然停止。
   */
  function tryUpgradeBuildingSteps(id: string, steps: number): number {
    return repeatUntilFail(steps, () => tryUpgradeBuilding(id))
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
    computeOfflineGains,
    setOfflineReport,
    // import/export
    doExport,
    doImport,
    corruptRaw,
    exportCorruptRaw,
    // atomic actions (3.12)
    tryUpgradeBuilding,
    tryUpgradeBuildingSteps,
    previewUpgradeBuildingSteps,
    previewRelicEnhanceSteps,
    tryResearch,
    // transcend
    canTranscend,
    previewTranscendGain,
    doTranscend,
  }
})
