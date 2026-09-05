/**
 * storage.test.ts — storage.ts 存档导出/导入测试
 *
 * 测试 exportSave / importSave 的编码-解码往返和完整性校验。
 * 不涉及 IndexedDB / localStorage（需要浏览器环境）。
 */
import { describe, it, expect } from 'vitest'
import { exportSave, importSave, type SaveData } from './storage'

function makeValidSaveData(): SaveData {
  return {
    version: 6,
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
    const fakeB64 = Buffer.from('not json at all').toString('base64')
    const result = await importSave('SCB-' + fakeB64)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  // —— v0.56 转生树双格式校验（旧档 purchased 必须能过校验才有机会被迁移）——
  it('importSave accepts legacy purchased-format tree (v5 档)', async () => {
    const data = makeValidSaveData()
    data.version = 5
    data.transcend.tree = [
      { id: 't_slot', purchased: true },
      { id: 't_starting', purchased: false },
    ]
    const exported = await exportSave(data)
    const result = await importSave(exported)
    expect(result.ok).toBe(true)
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
})
