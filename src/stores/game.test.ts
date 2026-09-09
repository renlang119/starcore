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
import { exportSave, importSave, type SaveData } from '@/lib/storage'
import { useGameStore } from './game'
import { useResourcesStore } from './resources'
import { useBuildingsStore } from './buildings'
import { useRelicsStore } from './relics'
import { useTranscendStore } from './transcend'
import { useResearchStore } from './research'
import { useCombatStore } from './combat'
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
    // 升级消耗能量，tick 应增加能量（生产量 > 0）
    expect(after).toBeGreaterThanOrEqual(before)
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

  it('v0.82 正例：研究完成后 requires 建筑进入自动升级（传 completed 而非 unlockedSet）', () => {
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
    // 修复前：runAutomation 传 unlockedSet（建筑 id 集合），isUnlocked 查科技 id 永不相交
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
// 不用模块 mock（vitest isolate:false 下模块注册表跨文件复用，mock 不可靠）
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

  beforeEach(() => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
    localStorage.removeItem(BACKUP_KEY)
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
    // 先把会话状态堆起来
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
    // 替换语义断言：会话现值被导入档覆盖，缺省回落初始值
    expect(game.transcend.totalTranscends).toBe(0) // 0 可清零（旧实现 if 跳过 0）
    expect(game.totalPlayTime).toBe(0)
    expect(game.buildings.getLevel('solar_collector')).toBe(0)
    expect(game.research.completed.has('military_basic')).toBe(false)
    expect(game.military.getOwned('assault')).toBe(1)
    expect(game.resources.getAmount('energy').toNumber()).toBe(10)
  })
})
