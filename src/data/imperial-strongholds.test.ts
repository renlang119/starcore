/**
 * imperial-strongholds.test.ts：帝庭据点线数据契约（v1.80）
 */
import { describe, it, expect } from 'vitest'
import {
  IMPERIAL_ANCHOR_BEST,
  IMPERIAL_AUDIT_ID,
  IMPERIAL_CLAIM_CAP_SECONDS,
  IMPERIAL_STRONGHOLDS,
  IMPERIAL_TIER3_MULT,
  IMPERIAL_TIER_MULT,
  FORGE_DECAY_PER_HOUR,
  FORGE_INPUT_RESOURCES,
  FORGE_STABILITY_MAX,
  FORGE_TRIBUTE_COST,
  FORGE_TRIBUTE_REFILL,
  FORGE_PICK_MULT,
  FORGE_REQUIRED_CAPTURES,
  FORGE_YIELD_BASE,
  forgeDecayed,
  forgeYield,
  forgeYieldTier,
  isForgeInputResource,
  pickForgeResource,
  getImperialStronghold,
  imperialAuditStronghold,
  imperialBattleStronghold,
  imperialTributeRate,
  imperialTributeScale,
  imperialUnlocked,
  imperialUpgradeCost,
  pickImperialAuditTarget,
} from './imperial-strongholds'
import { dispatchRewardScale } from './dispatch'

const EQ: Record<string, number> = { energy: 1, alloy: 1, data: 6, crystal: 55, dark: 8000 }

describe('imperial-strongholds — 数据', () => {
  it('6 座、id 唯一、资源覆盖五种', () => {
    expect(IMPERIAL_STRONGHOLDS).toHaveLength(6)
    expect(new Set(IMPERIAL_STRONGHOLDS.map((s) => s.id)).size).toBe(6)
    expect(new Set(IMPERIAL_STRONGHOLDS.map((s) => s.resource))).toEqual(
      new Set(['energy', 'alloy', 'data', 'crystal', 'dark'])
    )
  })

  it('A 档满接管当量 = 7.5e6 /s（三路派遣 5%）', () => {
    const total = IMPERIAL_STRONGHOLDS.reduce(
      (sum, s) => sum + imperialTributeRate(s, IMPERIAL_ANCHOR_BEST, 1) * EQ[s.resource],
      0
    )
    expect(total).toBeCloseTo(7_500_000, -2)
  })

  it('整备倍率 1.3 / 1.69', () => {
    const s = IMPERIAL_STRONGHOLDS[0]
    expect(imperialTributeRate(s, IMPERIAL_ANCHOR_BEST, 2)).toBeCloseTo(
      s.baseRate * IMPERIAL_TIER_MULT,
      6
    )
    expect(imperialTributeRate(s, IMPERIAL_ANCHOR_BEST, 3)).toBeCloseTo(
      s.baseRate * IMPERIAL_TIER3_MULT,
      6
    )
  })

  it('档间缩放与派遣奖励曲线同源', () => {
    const s = IMPERIAL_STRONGHOLDS[0]
    const ratio = dispatchRewardScale(38) / dispatchRewardScale(IMPERIAL_ANCHOR_BEST)
    expect(imperialTributeScale(38)).toBeCloseTo(ratio, 12)
    expect(imperialTributeRate(s, 38, 1)).toBeCloseTo(s.baseRate * ratio, 6)
  })

  it('整备成本 = 1 级贡赋 24h / 72h', () => {
    const s = IMPERIAL_STRONGHOLDS[0]
    expect(imperialUpgradeCost(s, IMPERIAL_ANCHOR_BEST, 2)).toEqual({
      energy: Math.round(s.baseRate * 24 * 3600),
    })
    expect(imperialUpgradeCost(s, IMPERIAL_ANCHOR_BEST, 3)).toEqual({
      energy: Math.round(s.baseRate * 72 * 3600),
    })
    expect(imperialUpgradeCost(s, IMPERIAL_ANCHOR_BEST, 1)).toBeNull()
  })

  it('解锁 = 银盘枢纽 + 节点 + 接管数', () => {
    const s = IMPERIAL_STRONGHOLDS[5]
    expect(imperialUnlocked(s, new Set(['node_arm_gate']), 5)).toBe(false)
    expect(imperialUnlocked(s, new Set([s.requires, 'node_galaxy_hub']), 4)).toBe(false)
    expect(imperialUnlocked(s, new Set([s.requires, 'node_galaxy_hub']), 5)).toBe(true)
    // 第 6 座 requires 本身即银盘枢纽，先验节点不单独构成解锁
    expect(imperialUnlocked(s, new Set([s.requires]), 5)).toBe(true)
  })

  it('战斗合成据点带 imperial 标记且无奖励', () => {
    const def = getImperialStronghold('imp_pass')!
    const battle = imperialBattleStronghold(def, 34)
    expect(battle.id).toBe('imp_pass')
    expect(battle.imperial).toBe(true)
    expect(battle.rewards).toEqual({})
    expect(battle.idle).toEqual({})
    const audit = imperialAuditStronghold(34, 3)
    expect(audit.id).toBe(IMPERIAL_AUDIT_ID)
    expect(audit.imperial).toBe(true)
    expect(audit.rewards).toEqual({})
  })

  it('巡检迎战档位（v1.82）：从严敌方深度 +1，标准按整备档基准', () => {
    const standard = imperialAuditStronghold(34, 3)
    const strict = imperialAuditStronghold(34, 3, 'strict')
    // 同一敌兵种构成下，从严整体面板更强（depth 36 → 37）
    expect(strict.enemies).toHaveLength(standard.enemies.length)
    const stdTotal = standard.enemies.reduce((s, e) => s + e.hp, 0)
    const strTotal = strict.enemies.reduce((s, e) => s + e.hp, 0)
    expect(strTotal).toBeGreaterThan(stdTotal)
    // 默认参 = 标准（旧调用点行为不变）
    expect(imperialAuditStronghold(34, 3)).toEqual(standard)
  })

  it('巡检目标同周确定、必在接管集内', () => {
    const ids = ['imp_pass', 'imp_audit', 'imp_guard']
    const a = pickImperialAuditTarget(ids, '2026-W45')
    const b = pickImperialAuditTarget(ids, '2026-W45')
    expect(a).toBe(b)
    expect(ids).toContain(a)
    expect(pickImperialAuditTarget([], '2026-W45')).toBeNull()
  })

  it('贡赋池上限常量 = 12h', () => {
    expect(IMPERIAL_CLAIM_CAP_SECONDS).toBe(12 * 3600)
  })
})

describe('imperial-strongholds — 炉域（v1.83）', () => {
  it('入口门槛 = 6；稳定度 0-100；衰减/回填/点名倍数契约', () => {
    expect(FORGE_REQUIRED_CAPTURES).toBe(6)
    expect(FORGE_STABILITY_MAX).toBe(100)
    expect(FORGE_DECAY_PER_HOUR).toBe(2)
    expect(FORGE_TRIBUTE_REFILL).toBe(24)
    expect(FORGE_PICK_MULT).toBe(3)
  })

  it('投入资源四选一，不含 data（防自循环套利）', () => {
    expect([...FORGE_INPUT_RESOURCES]).toEqual(['energy', 'crystal', 'alloy', 'dark'])
    expect(isForgeInputResource('data')).toBe(false)
    expect(isForgeInputResource('energy')).toBe(true)
    // 投入量为正数
    for (const r of FORGE_INPUT_RESOURCES) {
      expect(FORGE_TRIBUTE_COST[r]).toBeGreaterThan(0)
    }
  })

  it('产出档位边界：80/50/20', () => {
    expect(forgeYieldTier(100)).toBe(3)
    expect(forgeYieldTier(80)).toBe(3)
    expect(forgeYieldTier(79.99)).toBe(2)
    expect(forgeYieldTier(50)).toBe(2)
    expect(forgeYieldTier(49.99)).toBe(1)
    expect(forgeYieldTier(20)).toBe(1)
    expect(forgeYieldTier(19.99)).toBe(0)
    expect(forgeYieldTier(0)).toBe(0)
  })

  it('离线衰减补算：线性、到 0 停、负时长不动', () => {
    expect(forgeDecayed(100, 0)).toBe(100)
    expect(forgeDecayed(100, -3)).toBe(100)
    expect(forgeDecayed(100, 10)).toBe(80)
    expect(forgeDecayed(100, 10.5)).toBe(79)
    expect(forgeDecayed(50, 100)).toBe(0)
  })

  it('周点名资源确定性：同周同值、四选一内', () => {
    const a = pickForgeResource('2026-W46')
    const b = pickForgeResource('2026-W46')
    expect(a).toBe(b)
    expect(FORGE_INPUT_RESOURCES).toContain(a)
  })

  it('倾贡产出：档位线性、点名 ×3、20 以下无产出', () => {
    expect(forgeYield(100, false)).toBe(FORGE_YIELD_BASE * 3)
    expect(forgeYield(50, false)).toBe(FORGE_YIELD_BASE * 2)
    expect(forgeYield(20, false)).toBe(FORGE_YIELD_BASE)
    expect(forgeYield(100, true)).toBe(FORGE_YIELD_BASE * 3 * FORGE_PICK_MULT)
    expect(forgeYield(19.99, true)).toBe(0)
    expect(forgeYield(0, false)).toBe(0)
  })
})
