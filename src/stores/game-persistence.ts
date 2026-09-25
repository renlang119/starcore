/**
 * game-persistence.ts — 主 store 的存档簇（从 game.ts 拆出）。
 *
 * 存档数据组装、读写通道（异步/同步）、读档与 hydrate、导入导出、
 * 离线收益补算与清档重置。所依赖的状态 ref 与 store 由调用方注入，
 * 返回契约与拆分前一致（含错误态守卫：initError 置位时拒绝一切写入）。
 */
import { t } from '@/i18n'
import type { ComputedRef, Ref } from 'vue'
import type { Decimal } from '@/lib/decimal'
import { computeOfflineGains as calcOfflineGains, type OfflineReport } from '@/lib/offline-gains'
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
import { START_ENERGY } from './resources'
import type { useResourcesStore } from './resources'
import type { useBuildingsStore } from './buildings'
import type { useResearchStore } from './research'
import type { useMilitaryStore } from './military'
import type { useCombatStore } from './combat'
import type { useExplorationStore } from './exploration'
import type { useRelicsStore } from './relics'
import type { useTranscendStore } from './transcend'
import type { useAchievementsStore } from './achievements'
import type { useDailyStore } from './daily'
import type { useArchiveStore } from './archive'
import type { useEncountersStore } from './encounters'

type ResourcesStore = ReturnType<typeof useResourcesStore>
type BuildingsStore = ReturnType<typeof useBuildingsStore>
type ResearchStore = ReturnType<typeof useResearchStore>
type MilitaryStore = ReturnType<typeof useMilitaryStore>
type CombatStore = ReturnType<typeof useCombatStore>
type ExplorationStore = ReturnType<typeof useExplorationStore>
type RelicsStore = ReturnType<typeof useRelicsStore>
type TranscendStore = ReturnType<typeof useTranscendStore>
type AchievementsStore = ReturnType<typeof useAchievementsStore>
type DailyStore = ReturnType<typeof useDailyStore>
type ArchiveStore = ReturnType<typeof useArchiveStore>
type EncountersStore = ReturnType<typeof useEncountersStore>

export function createGamePersistence(deps: {
  resources: ResourcesStore
  buildings: BuildingsStore
  research: ResearchStore
  military: MilitaryStore
  combat: CombatStore
  exploration: ExplorationStore
  relics: RelicsStore
  transcend: TranscendStore
  achievements: AchievementsStore
  daily: DailyStore
  archive: ArchiveStore
  encounters: EncountersStore
  totalProduction: ComputedRef<Record<string, Decimal>>
  offlineMult: ComputedRef<Decimal>
  lastSaveTime: Ref<number>
  totalPlayTime: Ref<number>
  player: Ref<{ id: string; name: string }>
  offlineReport: Ref<OfflineReport | null>
  initError: Ref<'too_new' | 'corrupt' | 'failed' | null>
  corruptRaw: Ref<string | null>
  saveFailed: Ref<boolean>
  /** 终身计数快照对齐（toZero 归零；否则对齐当前 totals 现值） */
  alignLifetimeSnapshot: (toZero?: boolean) => void
  /** 游戏循环生命周期（清档重置时先停后启） */
  stop: () => void
  start: () => void
}) {
  const {
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
  } = deps

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
      archive: archive.serialize(),
      encounters: encounters.serialize(),
    }
  }

  // —— 存档（错误态守卫：initError 置位时拒绝一切写入，防空状态覆盖原始存档）——
  /**
   * 存档写入失败标志：双通道全失败（配额/隐私模式）时置位，由全局提示层
   * 给玩家可见反馈；下次成功保存自动清除。避免整段进度只在内存而玩家不知情。
   */
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
        // 主备档都在但都不可读：进错误屏给导出/清除出口，
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
    archive.hydrate(data.archive)
    encounters.hydrate(data.encounters)
    // 终身计数快照对齐已恢复的 totals——否则首个 tick 会把整轮历史产量
    // 当作增量重复计入终身计数
    deps.alignLifetimeSnapshot()
  }

  // —— 离线收益 ——
  function computeOfflineGains(elapsedOverride?: number): OfflineReport | null {
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
      collectOfflineDispatches: (from, to) => military.collectOfflineDispatches(from, to),
    })
  }

  function setOfflineReport(r: OfflineReport | null) {
    offlineReport.value = r
  }

  // —— 导出 / 导入 ——
  async function doExport(): Promise<string> {
    return exportSave(buildSaveData())
  }
  /** 错误屏「导出原始存档」：把损坏档的原始载荷原样交出（不解析不改写） */
  function exportCorruptRaw(): string {
    return corruptRaw.value ?? ''
  }
  /** 重置全部 store（doImport 替换语义与 hardReset 共用清单；combat 传 fullReset
   * 连远征深度一并清零。转生路径保留 relics/transcend 与远征深度，不纳入此清单） */
  function resetAllStores() {
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
    archive.reset()
    encounters.reset()
  }

  async function doImport(code: string): Promise<{ success: boolean; message?: string }> {
    const result = await importSave(code)
    if (!result.ok) {
      const msg =
        result.reason === 'corrupted'
          ? t('save.errTampered')
          : result.reason === 'too_new'
            ? t('save.errTooNew')
            : t('save.errInvalid')
      return { success: false, message: msg }
    }
    try {
      // 导入 = 替换语义：hydrate 各 store 只覆盖出现的键，
      // 不先 reset 的话导入档缺省字段会保留会话现值（totalTranscends=0 也无法清零）。
      // 重置后由 hydrateAll 恢复导入档快照，终身计数不重复计入
      resetAllStores()
      totalPlayTime.value = 0
      hydrateAll(result.data)
      await save()
      return { success: true }
    } catch {
      // hydrate 异常兜底：不再裸抛中断导入流程
      return { success: false, message: t('save.errBroken') }
    }
  }

  async function hardReset() {
    deps.stop()
    await clearSave()
    initError.value = null
    corruptRaw.value = null
    resetAllStores()
    deps.alignLifetimeSnapshot(true)
    offlineReport.value = null
    totalPlayTime.value = 0
    // 给初始资源
    resources.setAmount('energy', START_ENERGY)
    deps.start()
  }

  return {
    buildSaveData,
    save,
    saveSync,
    load,
    hydrateAll,
    computeOfflineGains,
    setOfflineReport,
    doExport,
    exportCorruptRaw,
    doImport,
    hardReset,
  }
}
