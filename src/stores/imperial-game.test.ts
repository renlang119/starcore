/**
 * imperial-game.test.ts：帝庭据点线门面接线（v1.80）
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from './game'
import { IMPERIAL_ANCHOR_BEST } from '@/data/imperial-strongholds'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('game — 帝庭据点门面', () => {
  it('领取贡赋写入资源并清池，成就只计满池领取', () => {
    const game = useGameStore()
    game.imperial.reset()
    game.resources.reset()
    const resources = game.resources
    game.combat.expeditionBest = IMPERIAL_ANCHOR_BEST
    const t0 = Date.now()
    game.imperial.capture('imp_pass', t0)
    const before = resources.getAmount('energy').toNumber()
    // 1 小时池（未满）：入账但不计成就
    game.claimImperialTribute(t0 + 3600 * 1000)
    expect(resources.getAmount('energy').toNumber()).toBeGreaterThan(before)
    expect(game.imperial.pool(IMPERIAL_ANCHOR_BEST, t0 + 3600 * 1000)).toEqual({})
    expect(game.achievements.lifetimeInt.imperialClaims).toBe(0)
    // 12 小时池（满）：入账且计一次
    game.claimImperialTribute(t0 + (3600 + 12 * 3600) * 1000)
    expect(game.achievements.lifetimeInt.imperialClaims).toBe(1)
    // 满池后同刻再领（空池）：不重复计数
    game.claimImperialTribute(t0 + (3600 + 12 * 3600) * 1000)
    expect(game.achievements.lifetimeInt.imperialClaims).toBe(1)
  })

  it('整备扣费成功，资源不足失败', () => {
    const game = useGameStore()
    game.imperial.reset()
    game.resources.reset()
    const resources = game.resources
    game.combat.expeditionBest = IMPERIAL_ANCHOR_BEST
    game.imperial.capture('imp_pass')
    expect(game.upgradeImperialStronghold('imp_pass')).toBe(false)
    resources.setAmount('energy', 1e15)
    expect(game.upgradeImperialStronghold('imp_pass')).toBe(true)
    expect(game.imperial.tierOf('imp_pass')).toBe(2)
  })

  it('巡检打点扣费并通过', () => {
    const game = useGameStore()
    game.imperial.reset()
    game.resources.reset()
    const resources = game.resources
    game.combat.expeditionBest = IMPERIAL_ANCHOR_BEST
    game.imperial.capture('imp_pass')
    game.imperial.ensureAudit('2026-W45', Date.now())
    resources.setAmount('energy', 1e15)
    expect(game.payImperialAudit()).toBe(true)
    expect(game.imperial.audit?.status).toBe('passed')
    expect(game.imperial.audit?.paid).toBe(true)
  })

  it('迎战结算：胜利通过，失败失守', () => {
    const game = useGameStore()
    game.imperial.reset()
    game.resources.reset()
    game.combat.expeditionBest = IMPERIAL_ANCHOR_BEST
    game.imperial.capture('imp_pass')
    const a = game.imperial.ensureAudit('2026-W45', Date.now())
    expect(game.imperial.isOccupied('imp_pass')).toBe(true)
    expect(a).not.toBeNull()
    expect(game.imperial.audit?.status).toBe('pending')
    expect(game.settleImperialAudit(true)).toBe(true)
    expect(game.imperial.audit?.status).toBe('passed')
    // 迎战胜利计入成就计数（v1.82）
    expect(game.achievements.lifetimeInt.auditWins).toBe(1)
    // 从严档位转发（v1.82）：bonus 1.3
    game.imperial.ensureAudit('2026-W46b', Date.now() + 8 * 24 * 3600 * 1000)
    expect(game.settleImperialAudit(true, 'strict')).toBe(true)
    expect(game.imperial.bonus).toBe(1.3)

    game.imperial.ensureAudit('2026-W46c', Date.now() + 8 * 24 * 3600 * 1000)
    expect(game.settleImperialAudit(false)).toBe(true)
    expect(game.imperial.isOccupied('imp_pass')).toBe(false)
    // 失守不增胜次
    expect(game.achievements.lifetimeInt.auditWins).toBe(2)
  })

  it('转生宽限（v1.82）：转生后待处理巡检顺延 7 天', () => {
    const game = useGameStore()
    game.imperial.reset()
    game.resources.reset()
    game.combat.expeditionBest = IMPERIAL_ANCHOR_BEST
    game.imperial.capture('imp_pass')
    const t0 = Date.now()
    const a = game.imperial.ensureAudit('2026-W45', t0)
    expect(a).not.toBeNull()
    game.resources.setAmount('energy', 1e9)
    game.resources.gain('energy', 1e12)
    expect(game.doTranscend()).toBe(true)
    expect(game.imperial.audit?.deadline).toBe(a!.deadline + 7 * 24 * 3600 * 1000)
  })
})

describe('game — 炉域门面（v1.83）', () => {
  const SIX = ['imp_pass', 'imp_audit', 'imp_guard', 'imp_verdict', 'imp_echo', 'imp_court']

  function setupForForge() {
    const game = useGameStore()
    game.imperial.reset()
    game.achievements.reset()
    game.resources.reset()
    for (const id of SIX) game.imperial.capture(id, 1_000)
    game.imperial.ensureAudit('2026-W46')
    game.imperial.markAuditPassed('strict')
    return game
  }

  it('首次进入置 forgeEntered（当帧可用于档案判读），重复进入不重置计数', () => {
    const game = setupForForge()
    expect(game.achievements.lifetimeInt.forgeEntered).toBe(0)
    expect(game.enterForge(2_000)).toBe(true)
    expect(game.achievements.lifetimeInt.forgeEntered).toBe(1)
    expect(game.achievements.metricValue('forgeEntered')).toBe(1) // 档案节七判读读此值
    expect(game.enterForge(3_000)).toBe(true)
    expect(game.achievements.lifetimeInt.forgeEntered).toBe(1) // 不重置
  })

  it('门槛未满足（巡检未过）：enterForge 拒绝且不置位', () => {
    const game = useGameStore()
    game.imperial.reset()
    game.achievements.reset()
    game.resources.reset()
    for (const id of SIX) game.imperial.capture(id, 1_000) // 不通过巡检
    expect(game.enterForge()).toBe(false)
    expect(game.achievements.lifetimeInt.forgeEntered).toBe(0)
  })

  it('倾贡：扣投入、发 data、计数三条（含点名响应）', () => {
    const game = setupForForge()
    game.enterForge(0)
    const resources = game.resources
    // 预置四种投入资源与 data 基线
    resources.gain('energy', 1e12)
    resources.gain('crystal', 1e12)
    resources.gain('alloy', 1e12)
    resources.gain('dark', 1e12)
    const dataBefore = resources.getAmount('data').toNumber()
    const r1 = game.tributeForge('energy', 0)
    // 回填 +24（v1.83 复审修正）：首投即进 20 档有产出（+12 时代的两投启动期不再）
    expect(r1).toBeGreaterThan(0)
    expect(game.achievements.lifetimeInt.forgeTributes).toBe(1)
    expect(resources.getAmount('data').toNumber()).toBeGreaterThan(dataBefore)
    const r2 = game.tributeForge('energy', 0)
    expect(r2 ?? 0).toBeGreaterThanOrEqual(r1 ?? 0)
    expect(game.achievements.lifetimeInt.forgeTributes).toBe(2)
  })

  it('倾贡资源不足：拒付且零计数', () => {
    const game = setupForForge() // reset 后 energy = START_ENERGY(50) < 1.2e6
    game.enterForge(0)
    const tributes = game.achievements.lifetimeInt.forgeTributes
    expect(game.tributeForge('energy', 0)).toBeNull()
    expect(game.achievements.lifetimeInt.forgeTributes).toBe(tributes)
  })
})
