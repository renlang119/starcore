/**
 * imperial.test.ts：帝庭据点 store（v1.80）
 *
 * 覆盖：接管 / 失守、贡赋池与上限、领取、整备、巡检生命周期、
 * 序列化与旧档兼容、reset。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImperialStore } from './imperial'
import {
  FORGE_YIELD_BASE,
  IMPERIAL_ANCHOR_BEST,
  IMPERIAL_CLAIM_CAP_SECONDS,
  pickForgeResource,
} from '@/data/imperial-strongholds'

let store: ReturnType<typeof useImperialStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useImperialStore()
})

describe('imperial — 接管与贡赋', () => {
  it('接管合法据点，非法 id 拒绝', () => {
    expect(store.capture('imp_pass', 1_000)).toBe(true)
    expect(store.isOccupied('imp_pass')).toBe(true)
    expect(store.tierOf('imp_pass')).toBe(1)
    expect(store.capture('raider_1', 1_000)).toBe(false)
    expect(store.occupiedCount).toBe(1)
  })

  it('贡赋按接管时长累积，领取后清零', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    const oneHour = 3600 * 1000
    const pool = store.pool(IMPERIAL_ANCHOR_BEST, t0 + oneHour)
    expect(pool.energy).toBeGreaterThan(0)
    const claimed = store.claim(IMPERIAL_ANCHOR_BEST, t0 + oneHour)
    expect(claimed.energy).toBe(pool.energy)
    expect(store.pool(IMPERIAL_ANCHOR_BEST, t0 + oneHour)).toEqual({})
  })

  it('贡赋池单座封顶 12 小时', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    const cap = store.pool(IMPERIAL_ANCHOR_BEST, t0 + IMPERIAL_CLAIM_CAP_SECONDS * 1000)
    const over = store.pool(
      IMPERIAL_ANCHOR_BEST,
      t0 + (IMPERIAL_CLAIM_CAP_SECONDS + 24 * 3600) * 1000
    )
    expect(over.energy ?? 0).toBeCloseTo(cap.energy ?? 0, 6)
  })

  it('逐座速率与合并速率一致', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    store.capture('imp_audit', t0)
    const rates = store.tributeRates(IMPERIAL_ANCHOR_BEST, t0)
    expect(rates.imp_pass).toBe(1_250_000)
    expect(rates.imp_audit).toBe(208_333)
    const totals = store.tributeTotals(IMPERIAL_ANCHOR_BEST, t0)
    expect(totals.energy).toBe(1_250_000)
    expect(totals.data).toBe(208_333)
    expect(store.hasEverCompleted('imp_pass')).toBe(true)
  })

  it('失守未接管据点为空操作', () => {
    store.lose('imp_pass')
    expect(store.occupiedCount).toBe(0)
  })

  it('新接管不倒补接管前的贡赋', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    const t1 = t0 + 3600 * 1000
    store.capture('imp_audit', t1)
    const pool = store.pool(IMPERIAL_ANCHOR_BEST, t1 + 3600 * 1000)
    // imp_pass 2 小时；imp_audit 仅 1 小时
    const passRate = store.rateOf('imp_pass', IMPERIAL_ANCHOR_BEST, t1)
    const auditRate = store.rateOf('imp_audit', IMPERIAL_ANCHOR_BEST, t1)
    expect(pool.energy).toBeCloseTo(passRate * 7200, 5)
    expect(pool.data).toBeCloseTo(auditRate * 3600, 5)
  })
})

describe('imperial — 整备', () => {
  it('成本按 1 级贡赋 24h 计，升级后速率 ×1.3', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    const cost = store.upgradeCost('imp_pass', IMPERIAL_ANCHOR_BEST)
    expect(cost?.energy).toBeGreaterThan(0)
    expect(store.upgrade('imp_pass')).toBe(true)
    expect(store.tierOf('imp_pass')).toBe(2)
    expect(store.rateOf('imp_pass', IMPERIAL_ANCHOR_BEST, t0)).toBeCloseTo(1_250_000 * 1.3, 3)
  })

  it('满 3 级后不可再升', () => {
    store.capture('imp_pass')
    store.upgrade('imp_pass')
    store.upgrade('imp_pass')
    expect(store.tierOf('imp_pass')).toBe(3)
    expect(store.upgrade('imp_pass')).toBe(false)
    expect(store.upgradeCost('imp_pass', IMPERIAL_ANCHOR_BEST)).toBeNull()
  })
})

describe('imperial — 周巡检', () => {
  it('同周幂等，目标在接管集内', () => {
    store.capture('imp_pass')
    store.capture('imp_audit')
    const a = store.ensureAudit('2026-W45', 1_000)
    const b = store.ensureAudit('2026-W45', 2_000)
    expect(a).not.toBeNull()
    expect(b).toEqual(a)
    expect(store.occupiedIds).toContain(a!.targetId)
  })

  it('迎战通过：目标保留，下周贡赋 ×1.1', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    const a = store.ensureAudit('2026-W45', t0)!
    expect(store.markAuditPassed()).toBe(true)
    expect(store.audit?.status).toBe('passed')
    expect(store.rateOf('imp_pass', IMPERIAL_ANCHOR_BEST, t0)).toBeCloseTo(1_250_000 * 1.1, 3)
    expect(store.audit?.targetId).toBe(a.targetId)
  })

  it('迎战通过档位（v1.82）：从严下周贡赋 ×1.3，标准默认 ×1.1', () => {
    store.capture('imp_pass')
    store.ensureAudit('2026-W46', Date.now())
    expect(store.markAuditPassed('strict')).toBe(true)
    expect(store.bonus).toBe(1.3)
    expect(store.rateOf('imp_pass', IMPERIAL_ANCHOR_BEST, Date.now())).toBeCloseTo(
      1_250_000 * 1.3,
      3
    )
    // 打点/失守后 bonus 归 1，再标准迎战回 1.1
    store.ensureAudit('2026-W47', Date.now())
    expect(store.markAuditPaid()).toBe(true)
    expect(store.bonus).toBe(1)
    store.ensureAudit('2026-W48', Date.now())
    expect(store.markAuditPassed('standard')).toBe(true)
    expect(store.bonus).toBe(1.1)
  })

  it('从严加成读回保留（v1.82）：hydrate 白名单认 1.1 与 1.3，异常值回落 1', () => {
    const base = {
      completed: ['imp_pass'],
      everCompleted: ['imp_pass'],
      tiers: {},
      capturedAt: { imp_pass: 0 },
      lastClaimAt: 0,
    }
    store.hydrate({ ...base, bonus: 1.3 })
    expect(store.bonus).toBe(1.3)
    store.hydrate({ ...base, bonus: 1.1 })
    expect(store.bonus).toBe(1.1)
    store.hydrate({ ...base, bonus: 1.2 as number })
    expect(store.bonus).toBe(1)
    store.hydrate({ ...base })
    expect(store.bonus).toBe(1)
  })

  it('迎战失败：目标失守，整备保留', () => {
    store.capture('imp_pass')
    store.upgrade('imp_pass')
    store.ensureAudit('2026-W45', 1_000)
    expect(store.markAuditFailed()).toBe(true)
    expect(store.isOccupied('imp_pass')).toBe(false)
    expect(store.tierOf('imp_pass')).toBe(2)
    expect(store.everCompleted.has('imp_pass')).toBe(true)
  })

  it('逾期：目标停摆但不失守，打点后恢复', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    store.ensureAudit('2026-W45', t0)
    store.refreshAudit(t0 + 73 * 3600 * 1000)
    expect(store.effectiveStatus(t0 + 73 * 3600 * 1000)).toBe('overdue')
    expect(store.rateOf('imp_pass', IMPERIAL_ANCHOR_BEST, t0 + 73 * 3600 * 1000)).toBe(0)
    expect(store.auditPayCost(IMPERIAL_ANCHOR_BEST)?.energy).toBeGreaterThan(0)
    expect(store.markAuditPaid()).toBe(true)
    expect(store.isOccupied('imp_pass')).toBe(true)
    expect(store.rateOf('imp_pass', IMPERIAL_ANCHOR_BEST, t0 + 73 * 3600 * 1000)).toBe(1_250_000)
  })

  it('未接管的周期不生成巡检', () => {
    expect(store.ensureAudit('2026-W45', 1_000)).toBeNull()
  })
})

describe('imperial — 边界与防御', () => {
  it('无效整备目标返回 null / false', () => {
    expect(store.upgradeCost('raider_1', IMPERIAL_ANCHOR_BEST)).toBeNull()
    expect(store.upgradeCost('imp_pass', IMPERIAL_ANCHOR_BEST)).toBeNull()
    expect(store.upgrade('imp_pass')).toBe(false)
  })

  it('巡检未生成时打点为 null，空操作返回 false', () => {
    expect(store.auditPayCost(IMPERIAL_ANCHOR_BEST)).toBeNull()
    expect(store.effectiveStatus(Date.now())).toBeNull()
    expect(store.markAuditPassed()).toBe(false)
    expect(store.markAuditPaid()).toBe(false)
    expect(store.markAuditFailed()).toBe(false)
    expect(store.refreshAudit()).toBeUndefined()
  })

  it('pending 未到期但直接查询时按 pending 返回', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    store.ensureAudit('2026-W45', t0)
    expect(store.effectiveStatus(t0 + 1000)).toBe('pending')
    expect(store.effectiveStatus(t0 + 73 * 3600 * 1000)).toBe('overdue')
  })

  it('打点成本可注入 now：pending 已过期未刷新即返回非 null', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    store.ensureAudit('2026-W45', t0)
    // 未调 refreshAudit，audit.status 仍为 pending，但注入的 now 已过 deadline
    expect(store.auditPayCost(IMPERIAL_ANCHOR_BEST, t0 + 73 * 3600 * 1000)).not.toBeNull()
    // 窗口内同样可查
    expect(store.auditPayCost(IMPERIAL_ANCHOR_BEST, t0 + 1000)).not.toBeNull()
    // 结算后不可再打点
    store.markAuditPaid()
    expect(store.auditPayCost(IMPERIAL_ANCHOR_BEST, t0 + 73 * 3600 * 1000)).toBeNull()
  })

  it('逾期目标从合并速率与贡赋池中剔除', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    store.capture('imp_audit', t0)
    store.ensureAudit('2026-W45', t0)
    store.refreshAudit(t0 + 73 * 3600 * 1000)
    const target = store.audit!.targetId
    const suspendedRes = target === 'imp_pass' ? 'energy' : 'data'
    const totals = store.tributeTotals(IMPERIAL_ANCHOR_BEST, t0 + 73 * 3600 * 1000)
    expect(totals[suspendedRes]).toBeUndefined()
    expect(Object.keys(totals).length).toBe(1)
    const pool = store.pool(IMPERIAL_ANCHOR_BEST, t0 + 73 * 3600 * 1000)
    expect(pool[suspendedRes]).toBeUndefined()
    expect(Object.keys(pool).length).toBe(1)
  })

  it('上一轮 pending 跨周不叠加，新周仍保留原巡检', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    const first = store.ensureAudit('2026-W45', t0)
    const second = store.ensureAudit('2026-W46', t0 + 8 * 24 * 3600 * 1000)
    expect(second).toEqual(first)
  })

  it('hydrate 处理缺省与非法字段', () => {
    store.hydrate(undefined)
    expect(store.occupiedCount).toBe(0)
    store.hydrate({
      completed: ['imp_pass'],
      tiers: { imp_pass: 'x' as unknown as number },
      lastClaimAt: -1,
      bonus: 2 as unknown as number,
      capturedAt: { imp_pass: -5 },
      audit: {
        week: 1 as unknown as string,
        targetId: 'imp_pass',
        deadline: Date.now(),
        status: 'bogus' as 'pending',
      },
    })
    expect(store.tierOf('imp_pass')).toBe(1)
    expect(store.bonus).toBe(1)
    expect(store.capturedAt.imp_pass).toBeUndefined()
    expect(store.audit).toBeNull()
  })
})

describe('imperial — 存档', () => {
  it('serialize / hydrate 往返保留接管、整备、巡检', () => {
    const t0 = Date.now()
    store.capture('imp_pass', t0)
    store.upgrade('imp_pass')
    store.ensureAudit('2026-W45', t0)
    const data = store.serialize()

    setActivePinia(createPinia())
    const next = useImperialStore()
    next.hydrate(data)
    expect(next.occupiedIds).toEqual(['imp_pass'])
    expect(next.tierOf('imp_pass')).toBe(2)
    expect(next.audit?.week).toBe('2026-W45')
  })

  it('hydrate 剥离未知 id 与非法整备等级（#23 删除语义：不钳制发放等级）', () => {
    const next = useImperialStore()
    next.hydrate({
      completed: ['imp_pass', 'raider_1'],
      tiers: { imp_pass: 9, raider_1: 2 },
      lastClaimAt: Date.now(),
      audit: {
        week: '2026-W45',
        targetId: 'raider_1',
        deadline: Date.now() + 1000,
        status: 'pending',
      },
    })
    expect(next.occupiedIds).toEqual(['imp_pass'])
    // 非法等级 9 跳过条目（原为钳制成 3），tierOf 回落默认 1
    expect(next.tierOf('imp_pass')).toBe(1)
    expect(next.audit).toBeNull()
  })

  it('#23 两条路径一致：{id: 7} 经 hydrate 回落到 1，与 validate 剥离后同果', () => {
    const next = useImperialStore()
    next.hydrate({
      completed: ['imp_pass'],
      tiers: { imp_pass: 7, imp_audit: 2 },
      lastClaimAt: 1,
    })
    // 非法 7 跳过回落 1；合法 2 原样保留
    expect(next.tierOf('imp_pass')).toBe(1)
    expect(next.tierOf('imp_audit')).toBe(2)
  })

  it('转生宽限（v1.82）：待处理巡检截止顺延 7 天，宽限内不生成新巡检', () => {
    const t0 = Date.now()
    const day = 24 * 3600 * 1000
    store.capture('imp_pass', t0)
    const a = store.ensureAudit('2026-W46', t0)
    expect(a).not.toBeNull()
    store.graceAfterTranscend(t0)
    expect(store.audit?.status).toBe('pending')
    expect(store.audit?.deadline).toBe(a!.deadline + 7 * day)
    // 宽限内换周不生成新巡检，仍返回原巡检
    expect(store.ensureAudit('2026-W47', t0 + day)?.week).toBe('2026-W46')
    // 结算后且宽限结束，新周巡检恢复生成
    expect(store.markAuditPaid()).toBe(true)
    expect(store.ensureAudit('2026-W48', t0 + 8 * day)?.week).toBe('2026-W48')
  })

  it('转生宽限：逾期巡检按转生时刻起算顺延', () => {
    const t0 = Date.now()
    const day = 24 * 3600 * 1000
    store.capture('imp_pass', t0)
    const a = store.ensureAudit('2026-W46', t0)
    const overdueAt = a!.deadline + 3 * day
    store.graceAfterTranscend(overdueAt)
    expect(store.audit?.status).toBe('pending')
    expect(store.audit?.deadline).toBe(overdueAt + 7 * day)
  })

  it('转生宽限读回（v1.82）：合法值保留，异常值回落 0', () => {
    const base = {
      completed: ['imp_pass'],
      everCompleted: ['imp_pass'],
      tiers: {},
      capturedAt: { imp_pass: 0 },
      lastClaimAt: 0,
    }
    store.hydrate({ ...base, auditGraceUntil: 123456 })
    expect(store.serialize().auditGraceUntil).toBe(123456)
    store.hydrate({ ...base, auditGraceUntil: -5 as number })
    expect(store.serialize().auditGraceUntil).toBe(0)
  })

  it('reset 清空全部帝庭状态', () => {
    store.capture('imp_pass')
    store.ensureAudit('2026-W45', 1_000)
    store.reset()
    expect(store.occupiedCount).toBe(0)
    expect(store.audit).toBeNull()
    expect(store.lastClaimAt).toBeGreaterThan(0)
  })
})

describe('imperial — 炉域（v1.83）', () => {
  const SIX = ['imp_pass', 'imp_audit', 'imp_guard', 'imp_verdict', 'imp_echo', 'imp_court']

  function unlockForForge(): void {
    for (const id of SIX) store.capture(id, 1_000)
    store.ensureAudit('2026-W46')
    store.markAuditPassed('strict')
  }

  it('入口门槛：六座全接管且曾通过巡检，缺一不可', () => {
    expect(store.forgeUnlocked).toBe(false)
    for (const id of SIX) store.capture(id, 1_000)
    expect(store.forgeUnlocked).toBe(false) // 巡检未过
    store.ensureAudit('2026-W46')
    store.markAuditPassed('standard')
    expect(store.forgeUnlocked).toBe(true)
  })

  it('enterForge：门槛内初始化 stability 0 且幂等；门槛外拒绝', () => {
    expect(store.enterForge()).toBe(false)
    expect(store.forge).toBeNull()
    unlockForForge()
    expect(store.enterForge(2_000)).toBe(true)
    expect(store.forge).toEqual({ stability: 0, lastTick: 2_000, day: 0, dayCount: 0 })
    expect(store.enterForge(3_000)).toBe(true) // 幂等：不重置
    expect(store.forge).toEqual({ stability: 0, lastTick: 2_000, day: 0, dayCount: 0 })
  })

  it('markAuditPassed 与 markAuditPaid 两路均置位 auditEverPassed', () => {
    store.capture('imp_pass', 1_000)
    store.ensureAudit('2026-W46')
    expect(store.markAuditPassed('standard')).toBe(true)
    expect(store.auditEverPassed).toBe(true)
    // 下一周打点路径（先重置再走 markAuditPaid）
    store.audit = null
    store.ensureAudit('2026-W47')
    store.$patch({})
    expect(store.markAuditPaid()).toBe(true)
    expect(store.auditEverPassed).toBe(true)
  })

  it('倾贡结算：回填 +24、日限 4 次、跨日重置、上限 100、衰减补算、点名 ×3', () => {
    unlockForForge()
    store.enterForge(0)
    const pickedRes = pickForgeResource('2026-W46')
    const normalRes = (['energy', 'crystal', 'alloy', 'dark'] as const).find(
      (r) => r !== pickedRes
    )!
    // 同日连投：0→24（24 以下首投无产出，先添柴）→48→72→96；第 5 次撞日限拒
    const r1 = store.tributeForge(normalRes, '2026-W46', 0)
    // 回填 +24：首投即 20 档，tier1 有产出（+12 时代的启动期不再，v1.83 复审修正）
    expect(r1).toEqual({ yield: FORGE_YIELD_BASE, picked: false, stability: 24 })
    expect(store.forgeRemainingToday(0)).toBe(3)
    store.tributeForge(normalRes, '2026-W46', 0)
    store.tributeForge(normalRes, '2026-W46', 0)
    const r4 = store.tributeForge(normalRes, '2026-W46', 0)
    expect(r4?.stability).toBe(96)
    expect(store.tributeForge(normalRes, '2026-W46', 0)).toBeNull() // 日限满
    expect(store.forgeRemainingToday(0)).toBe(0)
    // 跨日重置：96 - 48（24h 衰减）= 48 起步，+24×3 → 100 钳制
    const day2 = 86_400_000
    store.tributeForge(normalRes, '2026-W46', day2) // 48+24=72
    store.tributeForge(normalRes, '2026-W46', day2) // 72+24=96
    const rTop = store.tributeForge(normalRes, '2026-W46', day2) // 96+24→100 钳制
    expect(rTop?.stability).toBe(100)
    store.tributeForge(normalRes, '2026-W46', day2) // 100 钳制（日限第 4 次）
    // 再跨日离线 34h（day2 → 2*day2+10h）：100 - 68 + 24 = 56
    const rOff = store.tributeForge(normalRes, '2026-W46', 2 * day2 + 10 * 3_600_000)
    expect(rOff?.stability).toBe(56)
    // 点名 ×3：同稳定度下点名资源产出 = 非点名 ×3
    const rPick = store.tributeForge(pickedRes, '2026-W46', 2 * day2 + 10 * 3_600_000)
    const rNorm = store.tributeForge(normalRes, '2026-W46', 2 * day2 + 10 * 3_600_000)
    expect(rPick?.picked).toBe(true)
    expect(rNorm?.picked).toBe(false)
    expect(rPick?.yield).toBe((rNorm?.yield ?? 0) * 3)
  })

  it('倾贡拒非法：data 投入、未进入炉域', () => {
    unlockForForge()
    store.enterForge(0)
    // @ts-expect-error 故意传 data（运行时防御）
    expect(store.tributeForge('data', '2026-W46', 0)).toBeNull()
    store.forge = null
    expect(store.tributeForge('energy', '2026-W46', 0)).toBeNull()
  })

  it('forgeStability 显示补算：不落盘', () => {
    unlockForForge()
    store.enterForge(0)
    store.tributeForge('energy', '2026-W46', 0) // stability 24, lastTick 0
    expect(store.forgeStability(5 * 3_600_000)).toBe(14) // 24 - 10
    expect(store.forge?.stability).toBe(24) // 未落盘
  })

  it('serialize/hydrate 往返与旧档兜底（两可选域）', () => {
    unlockForForge()
    store.enterForge(5_000)
    store.tributeForge('energy', '2026-W46', 5_000)
    const saved = store.serialize()
    expect(saved.auditEverPassed).toBe(true)
    expect(saved.forge).toBeDefined()
    const s2 = useImperialStore()
    s2.hydrate(saved)
    expect(s2.auditEverPassed).toBe(true)
    expect(s2.forge).toEqual(store.forge)
    // 旧档（无两字段）：兜 false / null
    const s3 = useImperialStore()
    s3.hydrate({ completed: [], tiers: {}, lastClaimAt: 0 })
    expect(s3.auditEverPassed).toBe(false)
    expect(s3.forge).toBeNull()
    // 非法 forge（stability 越界）整体剥离
    const s4 = useImperialStore()
    s4.hydrate({
      completed: [],
      tiers: {},
      lastClaimAt: 0,
      forge: { stability: 500, lastTick: 0 },
    })
    expect(s4.forge).toBeNull()
  })

  it('reset 清炉域两域（hardReset 语义）', () => {
    unlockForForge()
    store.enterForge(0)
    store.reset()
    expect(store.auditEverPassed).toBe(false)
    expect(store.forge).toBeNull()
  })
})
