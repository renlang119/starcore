/**
 * game.ts：主游戏 store
 * 统筹子 store 装配、tick 主循环与生命周期；效果系统见 game-effects，
 * 存档簇见 game-persistence，奖励编排 / 操作层 / 转生协调分别见
 * game-rewards / game-actions / game-transcend
 */
import { t } from '@/i18n'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { D, add, type Decimal } from '@/lib/decimal'
import { useResourcesStore } from './resources'
import { useBuildingsStore } from './buildings'
import { useResearchStore } from './research'
import { useMilitaryStore } from './military'
import { useCombatStore } from './combat'
import { useExplorationStore } from './exploration'
import { useRelicsStore } from './relics'
import { useTranscendStore } from './transcend'
import { useAchievementsStore } from './achievements'
import { useDailyStore } from './daily'
import { useArchiveStore } from './archive'
import { useEncountersStore } from './encounters'
import { createGameEffects, wireGameProviders } from './game-effects'
import { createGamePersistence } from './game-persistence'
import { createGameRewards } from './game-rewards'
import { createGameActions } from './game-actions'
import { createGameTranscend } from './game-transcend'
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
  const archive = useArchiveStore()
  const encounters = useEncountersStore()

  // game meta state
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
   * corrupt：主备档都存在但全部不可读，与「无档」严格区分，
   * 不静默开新档（旧路径 15 秒后自动存档会用空状态覆盖损坏档，造成数据丢失）。
   * corruptRaw 保存原始存档载荷，供错误屏「导出原始存档」。
   */
  const initError = ref<'too_new' | 'corrupt' | 'failed' | null>(null)
  const corruptRaw = ref<string | null>(null)
  /**
   * 存档写入失败标志：任一写入通道失败时置位（如配额/隐私模式），由全局
   * 提示层给玩家可见反馈；下次成功保存自动清除。避免整段进度只在内存而玩家不知情。
   */
  const saveFailed = ref(false)

  // 效果系统与全局乘数
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

  // 各 store 一次性依赖注入（9 类 provider，详见 wireGameProviders）
  wireGameProviders({
    effectSystem,
    resources,
    relics,
    transcend,
    combat,
    military,
    exploration,
    totalPlayTime,
    daily,
    achievements,
    archive,
  })

  /**
   * 成就终身计数采集：totals 差值快照法。
   * resources.totals 记录本轮总产出（建筑 tick/探索奖励/战斗奖励/离线补算全部入 totals），
   * 每 tick 取与上次快照的差值计入终身计数，单点采集覆盖全部产出通道。
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

  // 存档簇（存档组装 / 读写通道 / hydrate / 导入导出 / 离线补算 / 清档重置），
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
    archive,
    encounters,
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

  // 奖励编排（每日挑战 / 随机遭遇 / 派遣远征 / 远征里程碑），
  const {
    claimChallenge,
    resolveEncounter,
    syncDispatchUnlocked,
    settleDispatches,
    lastDispatchResolution,
    claimMilestone,
  } = createGameRewards({ resources, military, combat, daily, encounters })

  // 操作层（原子操作 / 批量预览 / 自动化协议），
  const {
    tryUpgradeBuilding,
    tryUpgradeBuildingSteps,
    previewUpgradeBuildingSteps,
    previewRelicEnhanceSteps,
    tryResearch,
    runAutomation,
  } = createGameActions({
    resources,
    buildings,
    research,
    relics,
    achievements,
    daily,
    exploration,
    techCostMult,
    exploreMult,
    autoBuild,
    autoResearch,
    autoExplore,
  })

  // 转生协调（奇点重启），
  const { canTranscend, previewTranscendGain, doTranscend } = createGameTranscend({
    resources,
    buildings,
    research,
    military,
    combat,
    exploration,
    encounters,
    transcend,
    achievements,
    daily,
    prestigeMult,
    collectLifetimeTotals,
    alignLifetimeSnapshot,
  })

  /** 驻扎小时累计进位（v1.21 周挑战：内存小数累加，满 1 小时 bump；不入档） */
  const garrisonHourCarry = ref(0)

  // 主 tick
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
      // 短时离线（<5分钟）静默补算不弹窗，浏览器对不活跃标签页的
      // setInterval 有节流（常降至 1 次/分钟甚至更低），或系统短暂
      // 休眠唤醒，都会导致 dt 突然超过 60 秒。这种情况下玩家并未真正
      // "离开"，弹窗打扰体验。补算逻辑照常执行，仅抑制弹窗。
      if (report && dt >= OFFLINE_REPORT_THRESHOLD) setOfflineReport(report)
      dt = 1
    }
    totalPlayTime.value += dt

    // 1. 计算产出（使用 cached computed，避免每 tick 全量遍历建筑）
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
    // 周挑战驻扎时长（v1.21）：在线 tick 按驻扎据点数累计小时，
    // 满 1 小时 bump 一次（离线补算不计，时长口径与收益口径解耦）
    const garrisonCount = Object.keys(combat.garrisoned).length
    if (garrisonCount > 0) {
      garrisonHourCarry.value += (garrisonCount * dt) / 3600
      const hours = Math.floor(garrisonHourCarry.value)
      if (hours >= 1) {
        garrisonHourCarry.value -= hours
        daily.bump('garrisonHours', hours)
      }
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

    // 3.5 派遣（v1.27 方案 6）：解锁面同步 + 到点结算发放（回执由 UI 层消费）
    syncDispatchUnlocked()
    settleDispatches()

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

    // 5. 成就：终身计数采集 + 解锁判定（全表扫描，每秒一次开销可忽略）
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

    // 7. 随机遭遇事件（v1.26 方案 8）：在线限定掷骰 + 过期静默失效。
    // 挂起事件 toast 由 UI 层消费 pendingEvent 呈现，store 侧零 UI 依赖
    encounters.tick(now)
  }

  // 自动存档
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
    saveTimer = setInterval(save, 15000) // 自动存档周期 15 秒：压缩崩溃或误关时的进度丢失窗口
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

  /**
   * 显示用实时速率：建筑总产出与驻扎挂机收益的实时派生合并值，
   * 购买、升级、乘数与驻扎变化即时反映，不等下一 tick。
   * resources.getRate 是 tick 累加口径的每秒快照，显示面勿用。
   */
  function getDisplayRate(type: ResourceType): Decimal {
    const base = totalProduction.value[type] ?? D(0)
    return add(base, D(combat.garrisonProduction[type] ?? 0))
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
    archive,
    encounters,
    claimChallenge,
    claimMilestone,
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
    // atomic actions
    tryUpgradeBuilding,
    tryUpgradeBuildingSteps,
    previewUpgradeBuildingSteps,
    previewRelicEnhanceSteps,
    tryResearch,
    // 显示用实时速率（建筑 + 驻扎合并派生）
    getDisplayRate,
    // transcend
    canTranscend,
    previewTranscendGain,
    doTranscend,
    // encounters（v1.26）
    resolveEncounter,
    syncDispatchUnlocked,
    settleDispatches,
    lastDispatchResolution,
  }
})
