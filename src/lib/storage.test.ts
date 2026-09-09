/**
 * storage.test.ts — storage.ts 存档导出/导入测试
 *
 * 测试 exportSave / importSave 的编码-解码往返和完整性校验。
 * 不涉及 IndexedDB / localStorage（需要浏览器环境）。
 */
import { describe, it, expect } from 'vitest'
import { exportSave, importSave, type SaveData, type DailySaveData } from './storage'

/** 与 storage 内部一致（btoa + UTF-8 安全）的 base64 编码，构造测试载荷用 */
const toBase64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

function makeValidSaveData(): SaveData {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'p1', name: '指挥官' },
    resources: {
      amounts: { energy: '100', alloy: '50', crystal: '30', data: '20', dark: '5' },
      totals: { energy: '1000', alloy: '500', crystal: '300', data: '200', dark: '50' },
    },
    buildings: { levels: { solar_collector: 5, crystal_mine: 3 } },
    research: { completed: ['fusion_tech', 'energy_eff_1'] },
    military: {
      owned: { assault: 10, guard: 5 },
      training: [],
      formations: [{ id: 'f1', name: '编队1', units: { assault: 10, guard: 5 } }],
    },
    combat: { garrisoned: {}, completed: ['raider_1'] },
    exploration: {
      progress: {
        node_orbit: {
          nodeId: 'node_orbit',
          startTime: Date.now() - 60000,
          endTime: Date.now() + 60000,
          completed: false,
        },
      },
    },
    relics: {
      owned: [{ id: 'r_energy_1', instanceId: 'relic_test1', obtainedAt: Date.now() }],
      equipped: ['relic_test1', null, null, null],
    },
    transcend: {
      negativeEntropy: '3',
      totalTranscends: 1,
      tree: [
        { id: 't_slot', level: 1 },
        { id: 't_starting', level: 0 },
        { id: 't_inf_prod', level: 2 },
      ],
    },
  }
}

describe('storage export/import', () => {
  it('exportSave produces SCB- prefixed string', async () => {
    const data = makeValidSaveData()
    const exported = await exportSave(data)
    expect(exported.startsWith('SCB-')).toBe(true)
    expect(exported.length).toBeGreaterThan(10)
  })

  it('importSave round-trips valid data', async () => {
    const original = makeValidSaveData()
    const exported = await exportSave(original)
    const result = await importSave(exported)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.version).toBe(original.version)
      expect(result.data.player.name).toBe(original.player.name)
      expect(result.data.buildings.levels.solar_collector).toBe(5)
      expect(result.data.relics.owned.length).toBe(1)
      expect(result.data.transcend.totalTranscends).toBe(1)
      expect(result.data.exploration.progress.node_orbit).toBeDefined()
    }
  })

  it('importSave rejects empty string', async () => {
    const result = await importSave('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  it('importSave rejects non-SCB/SCE string', async () => {
    const result = await importSave('randomgarbage')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  it('importSave rejects tampered encoded data', async () => {
    const data = makeValidSaveData()
    const exported = await exportSave(data)
    // Tamper with the encoded portion
    const tampered = exported.slice(0, 10) + 'XX' + exported.slice(12)
    const result = await importSave(tampered)
    expect(result.ok).toBe(false)
  })

  it('importSave rejects corrupted (valid base64 but bad JSON)', async () => {
    // SCB- + valid base64 of non-JSON content
    const fakeB64 = toBase64('not json at all')
    const result = await importSave('SCB-' + fakeB64)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  // —— 转生树格式校验（purchased 旧格式已随 v0.73 兼容精简移除，仅 level 合法）——
  it('importSave rejects legacy purchased-format tree entries', async () => {
    const data = makeValidSaveData()
    data.transcend.tree = [
      { id: 't_slot', purchased: true },
      { id: 't_starting', purchased: false },
    ] as unknown as typeof data.transcend.tree
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(false)
  })

  it('importSave rejects invalid level values', async () => {
    for (const badLevel of [-1, 1.5, NaN, Infinity, '3']) {
      const data = makeValidSaveData()
      data.transcend.tree = [{ id: 't_inf_prod', level: badLevel as unknown as number }]
      const exported = await exportSave(data)
      const result = await importSave(exported)
      expect(result.ok, `level=${badLevel} should be rejected`).toBe(false)
    }
  })

  it('importSave rejects tree entries with neither purchased nor level', async () => {
    const data = makeValidSaveData()
    data.transcend.tree = [{ id: 't_slot' } as unknown as { id: string; level: number }]
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(false)
  })

  // —— 成就字段校验 ——
  it('importSave accepts save with achievements + totalPlayTime', async () => {
    const data = makeValidSaveData()
    data.version = 1
    data.totalPlayTime = 3600
    data.achievements = {
      lifetime: {
        energy: '100000',
        dark: '50',
        upgrades: 12,
        maxBuildingLevel: 5,
        researches: 3,
        explores: 4,
        battles: 8,
      },
      unlocked: { ach_energy_1: 1700000000000 },
    }
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.totalPlayTime).toBe(3600)
      expect(result.data.achievements?.lifetime.energy).toBe('100000')
    }
  })

  it('importSave accepts save without achievements (可选字段)', async () => {
    const data = makeValidSaveData()
    delete data.achievements
    delete data.totalPlayTime
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(true)
  })

  it('importSave rejects invalid achievements fields', async () => {
    const bad = [
      {
        lifetime: {
          energy: '-5',
          dark: '0',
          upgrades: 0,
          maxBuildingLevel: 0,
          researches: 0,
          explores: 0,
          battles: 0,
        },
        unlocked: {},
      },
      {
        lifetime: {
          energy: '0',
          dark: '0',
          upgrades: -1,
          maxBuildingLevel: 0,
          researches: 0,
          explores: 0,
          battles: 0,
        },
        unlocked: {},
      },
      {
        lifetime: {
          energy: '0',
          dark: '0',
          upgrades: 0,
          maxBuildingLevel: 0,
          researches: 0,
          explores: 0,
          battles: 0,
        },
        unlocked: { ach_energy_1: -1 },
      },
    ]
    for (const ach of bad) {
      const data = makeValidSaveData()
      data.achievements = ach as typeof data.achievements
      const exported = await exportSave(data)
      const result = await importSave(exported)
      expect(result.ok, `achievements=${JSON.stringify(ach).slice(0, 80)} should be rejected`).toBe(
        false
      )
    }
  })

  it('importSave rejects invalid totalPlayTime', async () => {
    const data = makeValidSaveData()
    data.totalPlayTime = -100
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(false)
  })

  // —— 遗物强化 level 可选字段 ——
  it('importSave accepts relic level field', async () => {
    const data = makeValidSaveData()
    data.relics = {
      owned: [{ id: 'r_energy_1', instanceId: 'relic_test1', obtainedAt: Date.now(), level: 5 }],
      equipped: ['relic_test1', null, null, null],
    }
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.relics.owned[0].level).toBe(5)
  })

  it('importSave rejects invalid relic level values', async () => {
    // 越上限/负数/非整数
    for (const badLevel of [21, -1, 1.5]) {
      const data = makeValidSaveData()
      data.relics = {
        owned: [
          { id: 'r_energy_1', instanceId: 'relic_test1', obtainedAt: 1, level: badLevel as number },
        ],
        equipped: [null, null, null, null],
      }
      const exported = await exportSave(data)
      const result = await importSave(exported)
      expect(result.ok, `level=${badLevel} should be rejected`).toBe(false)
    }
  })
})

/**
 * v0.75 存档安全与校验加固批回归：
 * A1 远征通关集污染自愈 / A2 空串裂缝 / 版本上限 / 校验体系补齐（training/formations/garrisoned/exploration/daily/兵力整数）
 */
describe('storage — 存档加固（v0.75）', () => {
  it('A1 自愈：completed 含远征 id "endless" 剥离后继续（不再整档拒绝）', async () => {
    const data = makeValidSaveData()
    data.combat.completed = ['raider_1', 'endless']
    const result = await importSave(await exportSave(data))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.combat.completed).toEqual(['raider_1'])
  })

  it('A2 空串裂缝：数值串空串/空白/非数形态一律拒绝', async () => {
    for (const bad of ['', '   ', 'abc', '1.2.3', '+5', '0x10', '1e']) {
      const data = makeValidSaveData()
      data.resources.amounts.energy = bad
      const result = await importSave(await exportSave(data))
      expect(result.ok, `amounts.energy=${JSON.stringify(bad)} 应拒绝`).toBe(false)
    }
  })

  it('A2 合法数值串形态仍接受（整数/小数/科学计数法）', async () => {
    for (const good of ['0', '100', '3.14', '1e+61', '2.5e-31']) {
      const data = makeValidSaveData()
      data.resources.amounts.energy = good
      const result = await importSave(await exportSave(data))
      expect(result.ok, `amounts.energy=${good} 应接受`).toBe(true)
    }
  })

  it('A2 终身计数与负熵同规（空串 / "abc" 拒绝）', async () => {
    const withAch = makeValidSaveData()
    withAch.achievements = {
      lifetime: {
        energy: '',
        dark: '0',
        upgrades: 0,
        maxBuildingLevel: 0,
        researches: 0,
        explores: 0,
        battles: 0,
      },
      unlocked: {},
    }
    expect((await importSave(await exportSave(withAch))).ok).toBe(false)

    const withNe = makeValidSaveData()
    withNe.transcend.negativeEntropy = 'abc'
    expect((await importSave(await exportSave(withNe))).ok).toBe(false)
  })

  it('版本上限：version > SAVE_VERSION 拒绝且 reason=too_new', async () => {
    const data = makeValidSaveData()
    data.version = 2
    const result = await importSave(await exportSave(data))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too_new')
  })

  it('military.owned 拒绝小数兵力', async () => {
    const data = makeValidSaveData()
    data.military.owned = { assault: 1.5 } as unknown as typeof data.military.owned
    expect((await importSave(await exportSave(data))).ok).toBe(false)
  })

  it('training 条目校验：未知兵种 / 非有限数字拒绝', async () => {
    const badUnit = makeValidSaveData()
    badUnit.military.training = [
      { id: 't1', unitId: 'dragon' as never, count: 1, remaining: 5, totalTime: 5 },
    ]
    expect((await importSave(await exportSave(badUnit))).ok).toBe(false)

    // NaN 经 JSON 序列化为 null → 非 number 形态拒绝（旧校验完全不看 training 条目）
    const badNum = makeValidSaveData()
    badNum.military.training = [
      { id: 't1', unitId: 'assault', count: 1, remaining: NaN, totalTime: 5 },
    ]
    expect((await importSave(await exportSave(badNum))).ok).toBe(false)
  })

  it('formations 条目校验：未知单位键拒绝；缺键条目接受（hydrate 补零）', async () => {
    const bad = makeValidSaveData()
    bad.military.formations = [{ id: 'f1', name: '编队', units: { dragon: 1 } as never }]
    expect((await importSave(await exportSave(bad))).ok).toBe(false)

    const missingKey = makeValidSaveData()
    missingKey.military.formations = [{ id: 'f1', name: '编队', units: { assault: 2 } as never }]
    expect((await importSave(await exportSave(missingKey))).ok).toBe(true)
  })

  it('garrisoned 白名单：未知据点拒绝', async () => {
    const data = makeValidSaveData()
    data.combat.garrisoned = {
      fake_fort: { strongholdId: 'fake_fort', formationId: 'f1', startTime: 1 },
    }
    expect((await importSave(await exportSave(data))).ok).toBe(false)
  })

  it('exploration：时间戳非有限拒绝（1e999 → Infinity）', async () => {
    const data = makeValidSaveData()
    const json = JSON.stringify(data)
    const marker = `"endTime":${data.exploration.progress.node_orbit.endTime}`
    const tampered = json.replace(marker, '"endTime":1e999')
    expect(tampered).not.toBe(json) // 替换命中
    const result = await importSave('SCB-' + toBase64(tampered))
    expect(result.ok).toBe(false)
  })

  it('exploration：未知节点条目丢弃（不整档拒绝）', async () => {
    const data = makeValidSaveData()
    ;(data.exploration.progress as Record<string, unknown>).ghost_node = {
      nodeId: 'ghost_node',
      startTime: 0,
      endTime: 0,
      completed: false,
    }
    expect((await importSave(await exportSave(data))).ok).toBe(true)
  })

  it('daily 结构校验：weekChallenges 非数组 / 计数器缺字段拒绝', async () => {
    const base: DailySaveData = {
      lastCheckIn: '2026-09-07',
      streak: 1,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: '2026-W37',
      weekChallenges: [],
    }
    const badChallenges = makeValidSaveData()
    badChallenges.daily = {
      ...base,
      weekChallenges: 'garbage' as unknown as DailySaveData['weekChallenges'],
    }
    expect((await importSave(await exportSave(badChallenges))).ok).toBe(false)

    const badCounters = makeValidSaveData()
    badCounters.daily = {
      ...base,
      weeklyCounters: { battles: 0 } as unknown as DailySaveData['weeklyCounters'],
    }
    expect((await importSave(await exportSave(badCounters))).ok).toBe(false)

    const good = makeValidSaveData()
    good.daily = base
    expect((await importSave(await exportSave(good))).ok).toBe(true)
  })
})

/**
 * v0.81 存档安全批回归：
 * 指数限位 / 无限节点等级上限 / training.count 整数 / 空编队自愈 /
 * totalTranscends 非负整数 / SCE 前缀合并兼容 / b64 中文往返 /
 * 双档取 savedAt 新者（readSave 真通道，jsdom）
 */
describe('storage — 存档安全（v0.81）', () => {
  it('指数限位：超长指数拒绝，6 位内科学计数法接受', async () => {
    // "1e99999999999999999"（17 位指数）旧正则放行 → deser Infinity → ser 出 "Infinity" → 整档判废
    for (const bad of ['1e99999999999999999', '1e9999999999999', '2.5e12345678901']) {
      const data = makeValidSaveData()
      data.resources.amounts.energy = bad
      const result = await importSave(await exportSave(data))
      expect(result.ok, `energy=${bad} 应拒绝`).toBe(false)
    }
    for (const good of ['1e999999', '2.5e+123456', '7e-999999', '1e0']) {
      const data = makeValidSaveData()
      data.resources.amounts.energy = good
      const result = await importSave(await exportSave(data))
      expect(result.ok, `energy=${good} 应接受`).toBe(true)
    }
  })

  it('无限节点 level 硬上限：超限拒绝，上限值本身接受', async () => {
    const data = makeValidSaveData()
    data.transcend.tree = [{ id: 't_inf_prod', level: 1_000_001 }]
    expect((await importSave(await exportSave(data))).ok).toBe(false)

    const okData = makeValidSaveData()
    okData.transcend.tree = [{ id: 't_inf_prod', level: 1_000_000 }]
    expect((await importSave(await exportSave(okData))).ok).toBe(true)
  })

  it('买断节点不受无限节点上限约束（上限仅按 INFINITE_NODE_IDS 生效）', async () => {
    const data = makeValidSaveData()
    // 买断节点 hydrate 层封顶 1，校验层只查无限节点上限
    data.transcend.tree = [{ id: 't_energy_1', level: 9 }]
    expect((await importSave(await exportSave(data))).ok).toBe(true)
  })

  it('training.count 小数拒绝，整数与浮点秒数接受', async () => {
    const bad = makeValidSaveData()
    bad.military.training = [
      { id: 't1', unitId: 'assault', count: 1.5, remaining: 5, totalTime: 5 },
    ]
    expect((await importSave(await exportSave(bad))).ok).toBe(false)

    const good = makeValidSaveData()
    good.military.training = [
      { id: 't1', unitId: 'assault', count: 3, remaining: 5.5, totalTime: 6.5 },
    ]
    expect((await importSave(await exportSave(good))).ok).toBe(true)
  })

  it('空编队数组自愈：formations=[] 通过校验并补齐 f1/f2/f3', async () => {
    const data = makeValidSaveData()
    data.military.formations = []
    const result = await importSave(await exportSave(data))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.military.formations.map((f) => f.id)).toEqual(['f1', 'f2', 'f3'])
      expect(result.data.military.formations[0].units.assault).toBe(0)
    }
  })

  it('totalTranscends：负数/小数拒绝，0 与正整数接受', async () => {
    for (const bad of [-1, 1.5]) {
      const data = makeValidSaveData()
      data.transcend.totalTranscends = bad
      expect((await importSave(await exportSave(data))).ok, `totalTranscends=${bad} 应拒绝`).toBe(
        false
      )
    }
    for (const good of [0, 42]) {
      const data = makeValidSaveData()
      data.transcend.totalTranscends = good
      expect((await importSave(await exportSave(data))).ok, `totalTranscends=${good} 应接受`).toBe(
        true
      )
    }
  })

  it('SCE- 旧前缀仍按 Base64(JSON) 解析（与 SCB- 同路径）', async () => {
    const data = makeValidSaveData()
    const code = 'SCE-' + toBase64(JSON.stringify(data))
    const result = await importSave(code)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.transcend.totalTranscends).toBe(1)
  })

  it('中文与 emoji 经导出/导入往返无损', async () => {
    const data = makeValidSaveData()
    data.player.name = '测试指挥官🌌'
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.player.name).toBe('测试指挥官🌌')
  })

  it('标准编码与旧 escape/unescape 实现产物互通（存量导出码不失效）', async () => {
    // 旧实现（escape/unescape）编码的中文存档，新实现必须能解
    const data = makeValidSaveData()
    data.player.name = '中文名'
    const legacyB64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    const result = await importSave('SCB-' + legacyB64)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.player.name).toBe('中文名')
  })
})
