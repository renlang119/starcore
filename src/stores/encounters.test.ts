/**
 * encounters store 测试 — 挂起/过期/冷却/结算生命周期（v1.26 方案 8）
 *
 * 覆盖：tick 掷骰触发与窗口冷却、60 秒过期静默失效、二选一结算与窗口重开、
 * 转生清空（本轮数据口径）、serialize/hydrate 往返（含离线归来过期失效、
 * 旧档缺键、未知 id 过滤）。
 * 随机通道全部注入固定值，时间用显式 now 参数推进（不依赖 fake timers）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEncountersStore, setEncounterRandomProvider } from './encounters'
import { ENCOUNTERS, ENCOUNTER_EXPIRE_MS, ENCOUNTER_IDS } from '@/data/encounters'
import { resetProviderSingletons } from '@/tests/reset-providers'

/** 固定随机通道：事件选取恒取池中第 0 个，窗口间隔恒取下界 */
function stubFirstEvent() {
  setEncounterRandomProvider(() => 0)
}

/** 测试基准时刻（取当前，避免固定过去值被 hydrate 判为离线过期） */
const T0 = Date.now()

describe('encounters store — tick 触发与窗口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetProviderSingletons()
    stubFirstEvent()
  })

  it('窗口未到不触发；到期首个 tick 挂起事件', () => {
    const store = useEncountersStore()
    // 预制窗口锚：固定通道下 rollIntervalMs 恒为下界 480_000（边界断言见数据表测试）
    store.nextTriggerAt = T0 + 480_000
    store.tick(T0 + 480_000 - 1)
    expect(store.pendingEventId).toBe('')
    store.tick(T0 + 480_000)
    expect(store.pendingEventId).not.toBe('')
    expect(store.pendingEvent).toBeDefined()
    expect(ENCOUNTER_IDS.has(store.pendingEventId)).toBe(true)
  })

  it('挂起期间不重复触发；窗口重开后可再触发', () => {
    const store = useEncountersStore()
    store.nextTriggerAt = T0
    store.tick(T0)
    const first = store.pendingEventId
    expect(first).not.toBe('')
    // 挂起期间继续 tick 不换事件
    store.tick(T0 + 1000)
    store.tick(T0 + 2000)
    expect(store.pendingEventId).toBe(first)
  })

  it('固定通道事件选取与窗口间隔均按注入值走', () => {
    const store = useEncountersStore()
    store.nextTriggerAt = T0
    store.tick(T0)
    // provider 恒 0 → 取 ENCOUNTERS[0]
    expect(store.pendingEventId).toBe(ENCOUNTERS[0]!.id)
  })
})

describe('encounters store — 过期失效', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetProviderSingletons()
    stubFirstEvent()
  })

  it('挂起 60 秒内有效，超时首个 tick 静默失效并重开窗口', () => {
    const store = useEncountersStore()
    store.nextTriggerAt = T0
    store.tick(T0)
    expect(store.pendingEventId).not.toBe('')

    const expireAt = T0 + ENCOUNTER_EXPIRE_MS
    expect(store.isExpired(expireAt)).toBe(false) // 恰在时限上不算过期（> 严格比较）
    expect(store.resolve('A', expireAt)).not.toBeNull()

    // 再挂起一个，推过时限
    store.nextTriggerAt = T0
    store.tick(T0)
    const afterExpire = T0 + ENCOUNTER_EXPIRE_MS + 1
    expect(store.isExpired(afterExpire)).toBe(true)
    expect(store.resolve('A', afterExpire)).toBeNull()
    store.tick(afterExpire)
    expect(store.pendingEventId).toBe('')
    // 窗口按 now 重开
    expect(store.nextTriggerAt).toBe(afterExpire + 480_000)
  })

  it('过期后 resolve 返回 null（不代选语义：UI 不应能结算过期事件）', () => {
    const store = useEncountersStore()
    store.pendingEventId = 'enc_flux'
    store.pendingAt = T0
    expect(store.resolve('A', T0 + ENCOUNTER_EXPIRE_MS + 1)).toBeNull()
  })
})

describe('encounters store — 结算', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetProviderSingletons()
  })

  it('选项 A 稳定结算（固定通道命中确定分支）并重开窗口', () => {
    const store = useEncountersStore()
    store.pendingEventId = 'enc_flux'
    store.pendingAt = T0
    // rollOutcome 只读模块级 provider（data 层），store 注入的是同一通道
    setEncounterRandomProvider(() => 0)
    const r = store.resolve('A', T0 + 1000)
    expect(r).toEqual({ encounterId: 'enc_flux', rewards: { energy: 8000 } })
    expect(store.pendingEventId).toBe('')
    expect(store.pendingAt).toBe(0)
    expect(store.nextTriggerAt).toBe(T0 + 1000 + 480_000)
  })

  it('选项 B 按分布掷取：固定通道命中对应分支', () => {
    const store = useEncountersStore()
    store.pendingEventId = 'enc_well'
    store.pendingAt = T0
    setEncounterRandomProvider(() => 0.1) // 命中 35% 大奖支
    const r = store.resolve('B', T0 + 1000)
    expect(r).toEqual({ encounterId: 'enc_well', rewards: { energy: 22000 } })

    // 再挂起一次， provider 恒 0.9 → 空手分支
    store.pendingEventId = 'enc_well'
    store.pendingAt = T0
    setEncounterRandomProvider(() => 0.9)
    const r2 = store.resolve('B', T0 + 1000)
    expect(r2).toEqual({ encounterId: 'enc_well', rewards: {} })
  })

  it('无挂起时 resolve 返回 null', () => {
    const store = useEncountersStore()
    expect(store.resolve('A')).toBeNull()
  })
})

describe('encounters store — serialize/hydrate 往返', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetProviderSingletons()
    stubFirstEvent()
  })

  it('挂起态往返：serialize 带三键，hydrate 恢复挂起', () => {
    const store = useEncountersStore()
    store.nextTriggerAt = T0 + 300_000
    store.pendingEventId = 'enc_vein'
    store.pendingAt = T0
    const data = store.serialize()
    expect(data).toEqual({
      nextTriggerAt: T0 + 300_000,
      pendingEventId: 'enc_vein',
      pendingAt: T0,
    })

    // 新实例恢复挂起（未过期）
    const store2 = useEncountersStore()
    store2.reset()
    store2.hydrate(data)
    expect(store2.pendingEventId).toBe('enc_vein')
    expect(store2.pendingAt).toBe(T0)
    expect(store2.nextTriggerAt).toBe(T0 + 300_000)
  })

  it('无挂起 serialize 最小化（只写窗口键，与旧档同构）', () => {
    const store = useEncountersStore()
    store.nextTriggerAt = T0 + 300_000
    expect(store.serialize()).toEqual({ nextTriggerAt: T0 + 300_000 })
  })

  it('离线归来挂起已过期：hydrate 直接失效不恢复', () => {
    const store = useEncountersStore()
    store.hydrate({
      nextTriggerAt: T0,
      pendingEventId: 'enc_vein',
      pendingAt: T0 - ENCOUNTER_EXPIRE_MS - 5_000,
    })
    expect(store.pendingEventId).toBe('')
    expect(store.nextTriggerAt).toBe(T0) // 窗口锚照常恢复
  })

  it('旧档缺 encounters 键与非法形态：hydrate 容缺保持默认', () => {
    const store = useEncountersStore()
    store.hydrate(undefined)
    expect(store.pendingEventId).toBe('')
    // 未知事件 id 被过滤
    store.hydrate({ nextTriggerAt: T0, pendingEventId: 'enc_hack', pendingAt: T0 })
    expect(store.pendingEventId).toBe('')
    // 非法时间戳被忽略
    store.hydrate({ nextTriggerAt: Number.NaN })
    expect(Number.isFinite(store.nextTriggerAt)).toBe(true)
  })

  it('validateSaveData：encounters 字段结构校验（非法形态整档拒绝）', async () => {
    const { validateAndRepair } = await import('@/lib/save/validate')
    const { minimalSaveData } = await import('@/tests/fixtures')
    // 合法形态通过
    const ok = minimalSaveData({
      encounters: { nextTriggerAt: T0, pendingEventId: 'enc_flux', pendingAt: T0 },
    })
    expect(validateAndRepair(ok)).toBe(true)
    // 非数字窗口拒绝
    const badWindow = minimalSaveData({ encounters: { nextTriggerAt: 'soon' } as unknown as never })
    expect(validateAndRepair(badWindow)).toBe(false)
    // 负挂起时刻拒绝
    const badPending = minimalSaveData({
      encounters: { nextTriggerAt: T0, pendingEventId: 'enc_flux', pendingAt: -1 },
    })
    expect(validateAndRepair(badPending)).toBe(false)
  })

  it('validateAndRepair：未知挂起 id 剥离后过校验（挂起丢失不拒档）', async () => {
    const { validateAndRepair } = await import('@/lib/save/validate')
    const { minimalSaveData } = await import('@/tests/fixtures')
    const data = minimalSaveData({
      encounters: { nextTriggerAt: T0, pendingEventId: 'enc_hack', pendingAt: T0 },
    })
    expect(validateAndRepair(data)).toBe(true)
    expect((data.encounters as { pendingEventId?: string }).pendingEventId).toBeUndefined()
  })
})
