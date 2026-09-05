/**
 * save-migrate.test.ts — 存档版本迁移链测试
 *
 * 重点：v5→v6 转生树 purchased → level 迁移（v0.56 转生树无限化）。
 */
import { describe, it, expect } from 'vitest'
import { migrateSave } from './save-migrate'
import type { SaveData } from './storage'

/** 构造最小合法 v5 存档（transcend.tree 为旧 purchased 格式） */
function makeV5Save(): SaveData {
  return {
    version: 5,
    savedAt: Date.now(),
    player: { id: 'p1', name: '指挥官' },
    resources: { amounts: {}, totals: {} },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [] },
    transcend: {
      negativeEntropy: '12',
      totalTranscends: 3,
      tree: [
        { id: 't_energy_1', purchased: true },
        { id: 't_alloy_1', purchased: false },
        { id: 't_slot', purchased: true },
      ],
    },
  }
}

describe('migrateSave — v5→v6 转生树 level 化', () => {
  it('purchased:true → level:1，false → level:0，版本号推进', () => {
    const data = makeV5Save()
    migrateSave(data, 6)
    expect(data.version).toBe(6)
    expect(data.transcend.tree).toEqual([
      { id: 't_energy_1', level: 1 },
      { id: 't_alloy_1', level: 0 },
      { id: 't_slot', level: 1 },
    ])
    // 其余字段不动
    expect(data.transcend.negativeEntropy).toBe('12')
    expect(data.transcend.totalTranscends).toBe(3)
  })

  it('已是 level 格式的条目原样保留（幂等/混合防御）', () => {
    const data = makeV5Save()
    data.transcend.tree = [
      { id: 't_inf_prod', level: 4 },
      { id: 't_energy_1', purchased: true },
    ]
    migrateSave(data, 6)
    expect(data.transcend.tree).toEqual([
      { id: 't_inf_prod', level: 4 },
      { id: 't_energy_1', level: 1 },
    ])
  })

  it('transcend 缺失/树为空不崩', () => {
    const data = makeV5Save()
    // 模拟损坏档：tree 缺失
    delete (data.transcend as Partial<typeof data.transcend>).tree
    expect(() => migrateSave(data, 6)).not.toThrow()
    expect(data.version).toBe(6)
  })

  it('v6 存档迁移到 v6 为 no-op', () => {
    const data = makeV5Save()
    migrateSave(data, 6)
    const before = JSON.stringify(data.transcend.tree)
    migrateSave(data, 6)
    expect(JSON.stringify(data.transcend.tree)).toBe(before)
  })

  it('更低版本档走完整迁移链到 v6（v1 起步）', () => {
    const data = makeV5Save()
    data.version = 1
    migrateSave(data, 6)
    expect(data.version).toBe(6)
    expect(data.transcend.tree.every((n) => 'level' in n)).toBe(true)
  })
})
