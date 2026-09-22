/**
 * archive.test.ts — 档案馆 store 测试（v1.18）
 *
 * 覆盖：
 * 1. 图鉴键全集完整性（正式据点全条目 116 键、远征不在其中）
 * 2. 交战遭遇记录（胜负口径一致由调用方保证，此处验记录行为与幂等）
 * 3. serialize/hydrate 往返 + 旧档（undefined）兼容 + 未知键剥离
 * 4. reset（清档用）清空；转生不调 reset（保留面在 game store 集成测试覆盖）
 * 5. 校验层：validateAndRepair 剥离未知图鉴键、结构非法拒绝
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useArchiveStore, ARCHIVE_ENEMY_KEYS } from './archive'
import { STRONGHOLDS } from '@/data/pve'
import { ENDLESS_STRONGHOLD_ID, endlessStronghold } from '@/data/endless'
import { validateAndRepair } from '@/lib/save/validate'
import { minimalSaveData } from '@/tests/fixtures'

let store: ReturnType<typeof useArchiveStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useArchiveStore()
})

describe('archive — 图鉴键全集', () => {
  it('键数 = 全部正式据点敌方条目数', () => {
    const total = STRONGHOLDS.reduce((a, s) => a + s.enemies.length, 0)
    expect(total).toBe(116)
    expect(ARCHIVE_ENEMY_KEYS.size).toBe(total)
  })

  it('键形 = 据点id#序号，覆盖每据点每个序号', () => {
    for (const s of STRONGHOLDS) {
      for (let i = 0; i < s.enemies.length; i++) {
        expect(ARCHIVE_ENEMY_KEYS.has(`${s.id}#${i}`)).toBe(true)
      }
    }
  })

  it('远征合成据点 id 不在键面', () => {
    expect(ARCHIVE_ENEMY_KEYS.has(ENDLESS_STRONGHOLD_ID)).toBe(false)
  })
})

describe('archive — 遭遇记录', () => {
  it('交战即记录该据点部敌方条目', () => {
    const s = STRONGHOLDS[0]
    store.recordEncounter(s.id, s.enemies)
    expect(store.seenCount).toBe(s.enemies.length)
    for (let i = 0; i < s.enemies.length; i++) {
      expect(store.hasSeen(`${s.id}#${i}`)).toBe(true)
    }
  })

  it('重复交战幂等（集合不重复计数）', () => {
    const s = STRONGHOLDS[0]
    store.recordEncounter(s.id, s.enemies)
    store.recordEncounter(s.id, s.enemies)
    expect(store.seenCount).toBe(s.enemies.length)
  })

  it('远征合成编成不入图鉴', () => {
    const endless = endlessStronghold(1)
    store.recordEncounter(ENDLESS_STRONGHOLD_ID, endless.enemies)
    expect(store.seenCount).toBe(0)
  })

  it('未知据点 id 不产生合法键（记录后 serialize/hydrate 被剥离）', () => {
    store.recordEncounter('ghost_stronghold', STRONGHOLDS[0].enemies)
    const saved = store.serialize()
    store.reset()
    store.hydrate(saved)
    expect(store.seenCount).toBe(0)
  })
})

describe('archive — 序列化与旧档兼容', () => {
  it('serialize/hydrate 往返一致', () => {
    const a = STRONGHOLDS[0]
    const b = STRONGHOLDS[10]
    store.recordEncounter(a.id, a.enemies)
    store.recordEncounter(b.id, b.enemies)
    const saved = store.serialize()
    expect(saved.enemies).toHaveLength(a.enemies.length + b.enemies.length)
    store.reset()
    store.hydrate(saved)
    expect(store.seenCount).toBe(a.enemies.length + b.enemies.length)
  })

  it('旧档 undefined = 空图鉴', () => {
    store.hydrate(undefined)
    expect(store.seenCount).toBe(0)
  })

  it('hydrate 剥离未知键（防注入）', () => {
    store.hydrate({ enemies: ['raider_1#0', 'hacked#9', 'endless#0', ''] })
    expect(store.seenCount).toBe(1)
    expect(store.hasSeen('raider_1#0')).toBe(true)
  })

  it('非数组字段整体忽略', () => {
    store.hydrate({ enemies: 'raider_1#0' as unknown as string[] })
    expect(store.seenCount).toBe(0)
  })

  it('reset 清空', () => {
    store.recordEncounter(STRONGHOLDS[0].id, STRONGHOLDS[0].enemies)
    store.reset()
    expect(store.seenCount).toBe(0)
  })
})

describe('archive — 存档校验层', () => {
  it('validateAndRepair 剥离未知图鉴键后整档通过', () => {
    const data = minimalSaveData({ archive: { enemies: ['raider_1#0', 'bad#1'] } })
    expect(validateAndRepair(data)).toBe(true)
    expect(data.archive?.enemies).toEqual(['raider_1#0'])
  })

  it('enemies 非数组（无法自愈的结构）整档拒绝', () => {
    const data = minimalSaveData({ archive: { enemies: 'x' as unknown as string[] } })
    expect(validateAndRepair(data)).toBe(false)
  })

  it('archive 非对象整档拒绝', () => {
    const data = minimalSaveData({ archive: 'x' as unknown as never })
    expect(validateAndRepair(data)).toBe(false)
  })

  it('合法全键档通过', () => {
    const enemies = Array.from(ARCHIVE_ENEMY_KEYS)
    const data = minimalSaveData({ archive: { enemies } })
    expect(validateAndRepair(data)).toBe(true)
  })
})
