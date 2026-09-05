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
import type { ResourceType } from '@/data/buildings'

const SAVE_VERSION = 6
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

  // 显式注入槽位扩展依赖，避免 relics store setup 阶段隐式引用 transcend
  setRelicSlotProvider(() => transcend.getValue('relic_slot'))
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

  /** 5.2：缓存总产出——仅当建筑等级或乘数变化时重算 */
  const totalProduction = computed(() => buildings.getTotalProduction(productionMults.value))

  // —— 计算属性直接暴露（已移除冗余包装函数）——

  // —— 主 tick ——
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

    // 3. 训练队列
    military.applyTick(dt)

    // 4. 探索进度
    const exploreResults = exploration.applyTick(exploreMult.value)
    for (const r of exploreResults) {
      // 发放探索奖励
      for (const [res, v] of Object.entries(r.rewards)) {
        resources.gain(res as ResourceType, v as number)
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
      resources: resources.serialize(),
      buildings: buildings.serialize(),
      research: research.serialize(),
      military: military.serialize(),
      combat: combat.serialize(),
      exploration: exploration.serialize(),
      relics: relics.serialize(),
      transcend: transcend.serialize(),
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
    resources.hydrate(data.resources)
    buildings.hydrate(data.buildings)
    research.hydrate(data.research)
    military.hydrate(data.military)
    combat.hydrate(data.combat)
    exploration.hydrate(data.exploration)
    transcend.hydrate(data.transcend)
    relics.hydrate(data.relics)
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
    combat.reset()
    exploration.reset()
    relics.reset()
    transcend.reset(true)
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
    // 执行转生
    transcend.transcend(gain)
    // 重置非保留项
    resources.reset(true) // 保留暗物质
    buildings.reset()
    research.reset()
    military.reset()
    combat.reset()
    exploration.reset()
    // relics 保留
    // transcend 保留
    // 初始能量加成
    const startingMult = transcend.getValue('starting_energy')
    if (startingMult > 0) {
      resources.setAmount('energy', 50 * startingMult)
    }
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
