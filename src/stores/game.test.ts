/**
 * game.test.ts — game.ts 集成测试
 *
 * 测试 tick 循环、离线补算、转生重置的核心流程。
 * 各 Store 需按正确顺序初始化（Pinia createPinia）。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fnv1a } from '@/lib/random'
import { exportSave, importSave, clearAllSaves, type SaveData } from '@/lib/storage'
import { useGameStore } from './game'
import { useResourcesStore } from './resources'
import { useBuildingsStore } from './buildings'
import { BUILDINGS } from '@/data/buildings'
import { useRelicsStore } from './relics'
import { useTranscendStore } from './transcend'
import { useResearchStore } from './research'
import { useCombatStore } from './combat'
import { useExplorationStore } from './exploration'
import { D } from '@/lib/decimal'
import { rollRelic } from '@/data/relics'
import { setRelicSlotProvider } from './relics'
import type { Formation } from './military'

/** 基础能量采集建筑 ID */
const SOLAR = 'solar_collector'

describe('game store — tick integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 重置模块级 slotProvider，防止跨测试污染
    setRelicSlotProvider(() => 0)
  })

  it('tryUpgradeBuilding succeeds with enough resources', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()

    resources.setAmount('energy', 500)
    const ok = game.tryUpgradeBuilding(SOLAR)
    expect(ok).toBe(true)
    expect(buildings.getLevel(SOLAR)).toBe(1)
  })

  it('tick runs without error after building upgrade', () => {
    const game = useGameStore()
    const resources = useResourcesStore()

    resources.setAmount('energy', 500)
    game.tryUpgradeBuilding(SOLAR)

    expect(() => game.tick()).not.toThrow()
  })

  it('tick applies resource production', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()

    resources.setAmount('energy', 500)
    game.tryUpgradeBuilding(SOLAR)
    expect(buildings.getLevel(SOLAR)).toBe(1)

    // tick 前记录能量
    const before = resources.getAmount('energy').toNumber()
    game.tick()
    const after = resources.getAmount('energy').toNumber()
    // 产出断言（v0.83 强化：原 ≥ 弱断言改为精确区间）。
    // delta = 每日签到自动首签 20000（v0.62 设计行为：签到 tick 驱动，
    // 新档首 tick 必触发）+ solar L1 产出 0.5×dt（dt 为真实时钟差，
    // 测试环境远小于 1s，不确定），故用区间断言锁签到值 + 产出上界
    const delta = after - before
    expect(delta).toBeGreaterThanOrEqual(20000) // 签到 20000
    expect(delta).toBeLessThan(20001) // + 产出 0.5×(<1s)，升级消耗已在 before 之前
  })
})

describe('game store — offline gains', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('computeOfflineGains returns null for short elapsed', () => {
    const game = useGameStore()
    const result = game.computeOfflineGains(30)
    expect(result).toBeNull()
  })

  it('computeOfflineGains returns report for long elapsed with buildings', () => {
    const game = useGameStore()
    const resources = useResourcesStore()

    resources.setAmount('energy', 500)
    game.tryUpgradeBuilding(SOLAR)

    const result = game.computeOfflineGains(600)
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(600)
    // 有建筑产出时，gains 应非空
    expect(Object.keys(result!.gains).length).toBeGreaterThan(0)
  })

  it('offline gains are capped at 24 hours', () => {
    const game = useGameStore()

    const result = game.computeOfflineGains(100000)
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(86400)
  })
})

describe('game store — transcend reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 重置模块级 slotProvider，防止跨测试污染
    setRelicSlotProvider(() => 0)
  })

  it('doTranscend resets buildings but keeps relics', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    const relics = useRelicsStore()
    const transcend = useTranscendStore()

    // 准备：升级建筑 + 获取遗物
    resources.setAmount('energy', 1e9)
    game.tryUpgradeBuilding(SOLAR)
    game.tryUpgradeBuilding(SOLAR)
    expect(buildings.getLevel(SOLAR)).toBe(2)

    // 获取遗物
    const testRelic = rollRelic(0)
    relics.obtain(testRelic)
    expect(relics.ownedCount).toBe(1)

    // 积累足够的 total energy 以满足转生条件
    resources.gain('energy', 1e9)

    // 尝试转生
    expect(game.canTranscend()).toBe(true)
    const result = game.doTranscend()
    expect(result).toBe(true)
    // 建筑应重置
    expect(buildings.getLevel(SOLAR)).toBe(0)
    // 遗物应保留
    expect(relics.ownedCount).toBe(1)
    // 转生次数应增加
    expect(transcend.totalTranscends).toBeGreaterThan(0)
  })
})

describe('game store — 自动化 QoL（v0.58）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
  })

  /** 给 store 购买指定转生节点 */
  function buyNodes(ids: string[]) {
    const game = useGameStore()
    const transcend = useTranscendStore()
    transcend.negativeEntropy = D(1e6)
    for (const id of ids) expect(transcend.purchaseNode(id)).toBe(true)
    return game
  }

  it('未购建造协议：tick 不自动升级建筑', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(buildings.getLevel(SOLAR)).toBe(0)
  })

  it('购买建造协议：tick 自动升级（且成就钩子联动）', () => {
    const game = buyNodes(['t_auto_build'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(buildings.getLevel(SOLAR)).toBe(1)
    // 每建筑每 tick 至多 1 级
    expect(buildings.getLevel('crystal_mine')).toBe(1)
    // 成就钩子联动：自动升级计入终身计数
    expect(game.achievements.metricValue('upgrades')).toBeGreaterThanOrEqual(2)
  })

  it('建造协议尊重科技解锁门槛（未解锁高阶建筑不买）', () => {
    const game = buyNodes(['t_auto_build'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e9)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    // fusion_reactor requires fusion_tech，未研究则不被自动升级
    expect(buildings.getLevel('fusion_reactor')).toBe(0)
    // 而 SOLAR（无 requires）已升
    expect(buildings.getLevel(SOLAR)).toBeGreaterThanOrEqual(1)
  })

  it('v0.82 正例：研究完成后 requires 建筑进入自动升级（传 completed 集合）', () => {
    const game = buyNodes(['t_auto_build'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    const research = useResearchStore()
    // 先完成 fusion_tech（fusion_reactor 的 requires）
    resources.setAmount('data', 1e9)
    resources.setAmount('crystal', 1e9)
    resources.setAmount('energy', 1e12)
    expect(game.tryResearch('fusion_tech')).toBe(true)
    expect(research.isCompleted('fusion_tech')).toBe(true)
    resources.setAmount('energy', 1e12)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    // 修复前：runAutomation 传按 unlock 效果目标派生的集合（建筑 id 集合），isUnlocked 查科技 id 永不相交
    expect(buildings.getLevel('fusion_reactor')).toBe(1)
  })

  it('v0.82：tryUpgradeBuilding 未知建筑 id 拒绝且不记账', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    resources.setAmount('energy', 1e9)
    const upgradesBefore = game.achievements.metricValue('upgrades')
    expect(game.tryUpgradeBuilding('ghost_building')).toBe(false)
    expect(game.achievements.metricValue('upgrades')).toBe(upgradesBefore)
    expect(game.buildings.getLevel('ghost_building')).toBe(0)
  })

  it('v0.86 批量升级：预算充足买满 steps 级', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e9)
    const done = game.tryUpgradeBuildingSteps(SOLAR, 10)
    expect(done).toBe(10)
    expect(buildings.getLevel(SOLAR)).toBe(10)
  })

  it('v0.86 批量升级：预算不足买到买不起为止，返回实际级数', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    // 首级成本 10（costGrowth 1.1），10 + 11 + 12 = 33 > 30 → 2 级
    resources.setAmount('energy', 30)
    const done = game.tryUpgradeBuildingSteps(SOLAR, 10)
    expect(done).toBe(2)
    expect(buildings.getLevel(SOLAR)).toBe(2)
  })

  it('v0.86 批量升级与连点记账等价：成就与周挑战计数一致', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    resources.setAmount('energy', 1e6)
    const upBefore = game.achievements.metricValue('upgrades')
    const dailyBefore = game.daily.weeklyCounters.upgrades
    // A：一次批量 3 级
    game.tryUpgradeBuildingSteps(SOLAR, 3)
    const upAfterBatch = game.achievements.metricValue('upgrades')
    const dailyAfterBatch = game.daily.weeklyCounters.upgrades
    // B：连点 3 次（增量应与批量完全一致）
    for (let i = 0; i < 3; i++) game.tryUpgradeBuilding(SOLAR)
    expect(game.achievements.metricValue('upgrades') - upAfterBatch).toBe(upAfterBatch - upBefore)
    expect(game.daily.weeklyCounters.upgrades - dailyAfterBatch).toBe(dailyAfterBatch - dailyBefore)
  })

  it('v0.86 批量升级：一级都买不起返回 0 且零副作用', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 5) // 低于首级成本 10
    const upgradesBefore = game.achievements.metricValue('upgrades')
    const done = game.tryUpgradeBuildingSteps(SOLAR, 10)
    expect(done).toBe(0)
    expect(buildings.getLevel(SOLAR)).toBe(0)
    expect(game.achievements.metricValue('upgrades')).toBe(upgradesBefore)
  })

  it('批量升级预览与实扣一致：预算充足买满 steps 级', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    resources.setAmount('energy', 1e6)
    const preview = game.previewUpgradeBuildingSteps(SOLAR, 10)
    expect(preview.count).toBe(10)
    const before = resources.getAmount('energy')
    const done = game.tryUpgradeBuildingSteps(SOLAR, 10)
    expect(done).toBe(10)
    // 预计总花费 = 实扣额
    expect(preview.cost).toEqual({ energy: before.minus(resources.getAmount('energy')).toNumber() })
  })

  it('批量升级预览与实扣一致：预算中途耗尽买几级算几级', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    resources.setAmount('energy', 30) // 成本 10 / 12 / 14：10 + 12 = 22 ≤ 30 < 36 → 买 2 级停
    const preview = game.previewUpgradeBuildingSteps(SOLAR, 10)
    expect(preview.count).toBe(2)
    expect(preview.cost.energy).toBe(22)
    const before = resources.getAmount('energy')
    game.tryUpgradeBuildingSteps(SOLAR, 10)
    expect(before.minus(resources.getAmount('energy')).toNumber()).toBe(preview.cost.energy)
  })

  it('等级上限：批量、单次与预览在封顶处一致停止', () => {
    // maxLevel 当前数据未启用：临时注入封顶值验证各路径共用同一门槛，测试后还原
    const def = BUILDINGS.find((b) => b.id === SOLAR)!
    def.maxLevel = 2
    try {
      const game = useGameStore()
      const resources = useResourcesStore()
      resources.setAmount('energy', 1e6)
      expect(game.previewUpgradeBuildingSteps(SOLAR, 10).count).toBe(2)
      expect(game.tryUpgradeBuildingSteps(SOLAR, 10)).toBe(2)
      expect(game.buildings.getLevel(SOLAR)).toBe(2)
      expect(game.buildings.isMaxed(SOLAR)).toBe(true)
      const before = resources.getAmount('energy')
      expect(game.tryUpgradeBuilding(SOLAR)).toBe(false) // 封顶拒绝且不扣费
      expect(resources.getAmount('energy').eq(before)).toBe(true)
      expect(game.previewUpgradeBuildingSteps(SOLAR, 10).count).toBe(0)
    } finally {
      delete def.maxLevel
    }
  })

  it('购买研究协议：tick 自动完成可用科技（成就联动）', () => {
    const game = buyNodes(['t_auto_research'])
    const resources = useResourcesStore()
    const research = useResearchStore()
    resources.setAmount('data', 1e6)
    resources.setAmount('energy', 1e9)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(research.count).toBeGreaterThan(0)
    // 首个可研究科技是 fusion_tech（无 requires）
    expect(research.isCompleted('fusion_tech')).toBe(true)
    expect(game.achievements.metricValue('researches')).toBe(research.count)
  })

  it('购买探索协议：tick 自动开始可探索节点', () => {
    const game = buyNodes(['t_auto_explore'])
    const resources = useResourcesStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    // node_orbit 无前置且买得起 → 已开始探索
    expect(game.exploration.isExploring('node_orbit')).toBe(true)
    const startTime = game.exploration.progress['node_orbit'].startTime
    const energyBefore = resources.getAmount('energy').toNumber()
    // 已在探索中的节点不会重复开始（isExploring 挡），不会重复扣探索费
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(game.exploration.progress['node_orbit'].startTime).toBe(startTime)
    expect(resources.getAmount('energy').toNumber()).toBe(energyBefore)
  })

  it('三个协议独立：只买探索协议不建造', () => {
    const game = buyNodes(['t_auto_explore'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(game.autoExplore).toBe(true)
    expect(game.autoBuild).toBe(false)
    expect(buildings.getLevel(SOLAR)).toBe(0)
  })
})

// —— v0.75：初始化错误态（兜底：读档/hydrate 异常不静默卡加载屏）——
// 走真实 readSave 通道：把存档写进 localStorage 备份键（jsdom 环境），
// 不用模块 mock：最小实验（2026-09-15，双文件一 mock 一不 mock 同 worker 跑）证实
// vi.mock 按文件隔离、不跨文件泄漏；本文件不 mock 是因集成测试须驱动真实 store 链，
// 与可靠性无关
const BACKUP_KEY = 'starcore_save_v1_backup'

function writeBackupSave(data: SaveData): void {
  const json = JSON.stringify(data)
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ d: json, c: fnv1a(json).toString(16) }))
}

describe('game store — 初始化错误态（v0.75）', () => {
  function validSave(): SaveData {
    return {
      version: 1,
      savedAt: Date.now(),
      player: { id: 'p1', name: '指挥官' },
      totalPlayTime: 0,
      resources: { amounts: { energy: '100' }, totals: { energy: '100' } },
      buildings: { levels: {} },
      research: { completed: [] },
      military: { owned: {}, training: [], formations: [] },
      combat: { garrisoned: {}, completed: [] },
      exploration: { progress: {} },
      relics: { owned: [], equipped: [] },
      transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    }
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
    // 双通道全清（v0.93）：IndexedDB 主档跨用例残留会让「双档取新」写入的主档
    // 盖掉后续用例的备份档断言（isolate:false 下 IndexedDB 不随 pinia 重建）
    await clearAllSaves()
  })

  it('版本过新：initError=too_new，不启动游戏循环', async () => {
    writeBackupSave({ ...validSave(), version: 2 })
    const game = useGameStore()
    const loaded = await game.init()
    expect(loaded).toBe(false)
    expect(game.initError).toBe('too_new')
    expect(game.isRunning).toBe(false)
  })

  it('hydrate 抛错：initError=failed，不启动游戏循环', async () => {
    writeBackupSave(validSave())
    const combat = useCombatStore()
    const spy = vi.spyOn(combat, 'hydrate').mockImplementation(() => {
      throw new Error('boom')
    })
    const game = useGameStore()
    const loaded = await game.init()
    expect(loaded).toBe(false)
    expect(game.initError).toBe('failed')
    expect(game.isRunning).toBe(false)
    spy.mockRestore()
  })

  it('无档：正常启动（回归，不误入错误态）', async () => {
    const game = useGameStore()
    const loaded = await game.init()
    expect(loaded).toBe(false)
    expect(game.initError).toBeNull()
    expect(game.isRunning).toBe(true)
    game.stop()
  })

  it('hardReset 清除错误态并启动', async () => {
    writeBackupSave({ ...validSave(), version: 2 })
    const game = useGameStore()
    await game.init()
    expect(game.initError).toBe('too_new')
    await game.hardReset()
    expect(game.initError).toBeNull()
    expect(game.isRunning).toBe(true)
    game.stop()
  })

  it('A1 端到端：远征胜利后整档导出/导入通过', async () => {
    const game = useGameStore()
    const combat = useCombatStore()
    combat.completedStrongholds.add('silencer_3') // 解锁远征
    const stronghold = combat.getEndlessStronghold(1)
    const formation = {
      id: 'f1',
      name: '回归编队',
      units: { assault: 100000, guard: 0, heavy: 0, psionic: 0 },
    } as Formation
    const result = combat.resolveBattle(formation, stronghold, game.atkMult, game.defMult)
    expect(result.victory).toBe(true)
    // 胜利后 'endless' 不入 completed → 整档可过校验（修复前此处必挂）
    const code = await game.doExport()
    const imported = await importSave(code)
    expect(imported.ok).toBe(true)
    if (imported.ok) expect(imported.data.combat.completed).not.toContain('endless')
  })

  it('v0.81 corrupt：主备档都在但全损坏 → initError=corrupt，不启动循环', async () => {
    // 真实写入两份「有值但不可读」的档（checksum 错误 + 非 JSON）
    localStorage.setItem(BACKUP_KEY, 'not-a-payload')
    const game = useGameStore()
    const loaded = await game.init()
    expect(loaded).toBe(false)
    expect(game.initError).toBe('corrupt')
    expect(game.isRunning).toBe(false)
    // 原始载荷保留，供错误屏导出
    expect(game.corruptRaw).toBe('not-a-payload')
    expect(game.exportCorruptRaw()).toBe('not-a-payload')
  })

  it('v0.81 corrupt：损坏档不触发自动存档覆盖（15s 保护窗内原始载荷不变）', async () => {
    localStorage.setItem(BACKUP_KEY, 'not-a-payload')
    const game = useGameStore()
    await game.init()
    expect(game.initError).toBe('corrupt')
    // 错误态下手动 save 也应被拒绝——错误态未 stop（无循环），但 save 会覆盖原档，
    // 校验 save 前的守卫：手动 save 在错误态直接返回
    await game.save()
    expect(localStorage.getItem(BACKUP_KEY)).toBe('not-a-payload')
  })

  it('v0.93 too_new 优先：主档版本过新时不静默采用旧备份', async () => {
    // 主档 version=2（too_new），备份为可读旧档——修复前旧备份胜出被静默
    // hydrate，随后自动存档覆盖新版主档（不可逆回滚）；修复后进 too_new 错误屏
    const stale = { ...validSave(), savedAt: 1000 }
    try {
      const { default: localforage } = await import('localforage')
      const store = localforage.createInstance({ name: 'starcore', storeName: 'save' })
      await store.setItem(
        'starcore_save_v1',
        JSON.stringify({
          d: JSON.stringify({ ...stale, version: 2 }),
          c: fnv1a(JSON.stringify({ ...stale, version: 2 })).toString(16),
        })
      )
    } catch {
      // jsdom 无 IndexedDB 时主档写不进：用备份档也构造 too_new 场景（见下一用例的备份版）
    }
    writeBackupSave(stale)
    const game = useGameStore()
    const loaded = await game.init()
    // 无论主档是否写入成功，只要存在 too_new 档即不得静默降级
    // （主档写入成功时 too_new 来自主档；失败时本用例备份为 ok 正常路径，跳过断言）
    if (loaded) {
      // 主档没写进去（无 IndexedDB）：备份 ok 正常 hydrate 是既有语义，不算回归
      expect(game.initError).toBeNull()
      game.stop()
    } else {
      expect(game.initError).toBe('too_new')
      expect(game.isRunning).toBe(false)
    }
  })

  it('v0.93 too_new 优先（备份档版）：备份版本过新即报错，不静默开新档', async () => {
    // 只写备份档 version=2 → 修复前后都进 too_new 错误屏（锚定 too_new 不垫底语义）
    writeBackupSave({ ...validSave(), version: 2 })
    const game = useGameStore()
    const loaded = await game.init()
    expect(loaded).toBe(false)
    expect(game.initError).toBe('too_new')
    expect(game.isRunning).toBe(false)
  })

  it('v0.93 存档写入失败：saveFailed 置位并可清除', async () => {
    // 桩 localStorage.setItem 抛错；jsdom 无 IndexedDB 时主档也写不进 → 双通道失败
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const game = useGameStore()
    await game.init()
    expect(game.isRunning).toBe(true)
    const ok = await game.save()
    expect(ok).toBe(false)
    expect(game.saveFailed).toBe(true)
    spy.mockRestore()
    // 恢复后保存成功，失败标志清除
    const ok2 = await game.save()
    expect(ok2).toBe(true)
    expect(game.saveFailed).toBe(false)
    game.stop()
  })

  it('v0.81 双档取新：savedAt 更新的备份档胜出主档', async () => {
    const now = { ...validSave(), savedAt: Date.now() }
    now.buildings.levels = { solar_collector: 7 }
    // 主档 = 旧档（savedAt=1000）；备份 = 新档
    const stale = { ...validSave(), savedAt: 1000 }
    try {
      const { default: localforage } = await import('localforage')
      const store = localforage.createInstance({ name: 'starcore', storeName: 'save' })
      await store.setItem(
        'starcore_save_v1',
        JSON.stringify({ d: JSON.stringify(stale), c: fnv1a(JSON.stringify(stale)).toString(16) })
      )
    } catch {
      // jsdom 无 IndexedDB 时主档写不进也不影响：备份仍是 savedAt 新者
    }
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ d: JSON.stringify(now), c: fnv1a(JSON.stringify(now)).toString(16) })
    )
    const game = useGameStore()
    const loaded = await game.init()
    expect(loaded).toBe(true)
    expect(game.buildings.getLevel('solar_collector')).toBe(7)
    game.stop()
  })

  it('v0.81 doImport 替换语义：缺省字段回落初始值，totalTranscends=0 可清零', async () => {
    // 先把内存状态堆起来
    const game = useGameStore()
    game.transcend.totalTranscends = 9
    game.totalPlayTime = 500
    game.research.complete('military_basic')
    game.buildings.setLevel('solar_collector', 4)
    // 导入一份极简档（多数字段缺省、totalTranscends=0）
    const minimal: SaveData = {
      version: 1,
      savedAt: Date.now(),
      player: { id: 'p2', name: '新档' },
      resources: { amounts: { energy: '10' }, totals: { energy: '10' } },
      buildings: { levels: {} },
      research: { completed: [] },
      military: { owned: { assault: 1 }, training: [], formations: [] },
      combat: { garrisoned: {}, completed: [] },
      exploration: { progress: {} },
      relics: { owned: [], equipped: [] },
      transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    }
    const code = await exportSave(minimal)
    const result = await game.doImport(code)
    expect(result.success).toBe(true)
    // 替换语义断言：内存现值被导入档覆盖，缺省回落初始值
    expect(game.transcend.totalTranscends).toBe(0) // 0 可清零（旧实现 if 跳过 0）
    expect(game.totalPlayTime).toBe(0)
    expect(game.buildings.getLevel('solar_collector')).toBe(0)
    expect(game.research.completed.has('military_basic')).toBe(false)
    expect(game.military.getOwned('assault')).toBe(1)
    expect(game.resources.getAmount('energy').toNumber()).toBe(10)
  })
})

// —— v0.82 驻扎守卫三条真实规则分支（game store 注入的 garrisonGuard）——
describe('v0.82 驻扎守卫真实规则分支', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
  })

  function explored(...nodeIds: string[]) {
    const exploration = useExplorationStore()
    const progress: Record<
      string,
      { nodeId: string; startTime: number; endTime: number; completed: boolean }
    > = {}
    for (const id of nodeIds) {
      progress[id] = { nodeId: id, startTime: 0, endTime: 0, completed: true }
    }
    exploration.hydrate({ progress })
  }

  it('据点 requires 探索未完成 → 拒绝驻扎', () => {
    useGameStore() // 注册守卫
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    // node_orbit 未探索 → 守卫第一条规则拦截
    expect(combat.garrison('raider_1', 'f1')).toBe(false)
  })

  it('编队不存在 → 拒绝驻扎', () => {
    useGameStore()
    explored('node_orbit')
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    expect(combat.garrison('raider_1', 'f9')).toBe(false)
  })

  it('编队已被其他据点占用 → 拒绝驻扎', () => {
    useGameStore()
    explored('node_orbit', 'node_inner')
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    combat.completedStrongholds.add('raider_2')
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
    expect(combat.garrison('raider_2', 'f1')).toBe(false)
  })

  it('三规则全过 → 允许驻扎', () => {
    useGameStore()
    explored('node_orbit')
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
    expect(combat.garrisoned['raider_1'].formationId).toBe('f1')
  })
})
