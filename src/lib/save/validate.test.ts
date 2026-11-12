/**
 * validate.test.ts：存档校验中的帝庭据点域（v1.80）
 */
import { describe, it, expect } from 'vitest'
import { validateAndRepair } from './validate'
import { minimalSaveData } from '@/tests/fixtures'

function withImperial(imperial: unknown) {
  return minimalSaveData({ imperial: imperial as never })
}

describe('validate — imperial 域', () => {
  it('合法帝庭存档通过并保留', () => {
    const data = withImperial({
      completed: ['imp_pass'],
      everCompleted: ['imp_pass'],
      tiers: { imp_pass: 2 },
      capturedAt: { imp_pass: 1 },
      lastClaimAt: 2,
      bonus: 1.1,
      audit: {
        week: '2026-W45',
        targetId: 'imp_pass',
        deadline: 3,
        status: 'pending',
        paid: false,
      },
    })
    expect(validateAndRepair(data)).toBe(true)
    expect(data.imperial?.completed).toEqual(['imp_pass'])
    expect(data.imperial?.tiers.imp_pass).toBe(2)
    expect(data.imperial?.audit?.status).toBe('pending')
  })

  it('未知据点、非法等级与捕获时刻条目级剥离（#23 删除语义：7 与 9 同判据）', () => {
    const data = withImperial({
      completed: ['imp_pass', 'raider_1'],
      everCompleted: ['imp_audit', 'raider_1'],
      tiers: { imp_pass: 9, imp_audit: 7, raider_1: 2 },
      capturedAt: { imp_pass: -1, raider_1: 5 },
      lastClaimAt: 1,
    })
    expect(validateAndRepair(data)).toBe(true)
    expect(data.imperial?.completed).toEqual(['imp_pass'])
    expect(data.imperial?.everCompleted).toEqual(['imp_audit'])
    // 剥离后 tiers 为空，tierOf 回落默认 1（与 hydrate 路径同果）
    expect(data.imperial?.tiers).toEqual({})
    expect(data.imperial?.capturedAt).toEqual({})
  })

  it('未知巡检目标整段删除', () => {
    const data = withImperial({
      completed: ['imp_pass'],
      tiers: { imp_pass: 1 },
      lastClaimAt: 1,
      audit: {
        week: '2026-W45',
        targetId: 'raider_1',
        deadline: 2,
        status: 'pending',
      },
    })
    expect(validateAndRepair(data)).toBe(true)
    expect(data.imperial?.audit).toBeUndefined()
  })

  it('结构非法整档拒绝', () => {
    expect(validateAndRepair(withImperial('x'))).toBe(false)
    expect(
      validateAndRepair(withImperial({ completed: 'imp_pass', tiers: {}, lastClaimAt: 1 }))
    ).toBe(false)
    expect(validateAndRepair(withImperial({ completed: [], tiers: [], lastClaimAt: 1 }))).toBe(
      false
    )
    expect(validateAndRepair(withImperial({ completed: [], tiers: {}, lastClaimAt: -1 }))).toBe(
      false
    )
    const captured = withImperial({
      completed: [],
      tiers: {},
      lastClaimAt: 1,
      capturedAt: { imp_pass: -1 },
    })
    expect(validateAndRepair(captured)).toBe(true)
    expect(captured.imperial?.capturedAt).toEqual({})
    expect(
      validateAndRepair(withImperial({ completed: [], tiers: {}, lastClaimAt: 1, bonus: 2 }))
    ).toBe(false)
  })

  it('巡检字段结构非法整档拒绝', () => {
    const base = { completed: [], tiers: {}, lastClaimAt: 1 }
    expect(
      validateAndRepair(
        withImperial({
          ...base,
          audit: { week: 1, targetId: 'imp_pass', deadline: 1, status: 'pending' },
        })
      )
    ).toBe(false)
    const badTarget = withImperial({
      ...base,
      audit: { week: 'w', targetId: 1, deadline: 1, status: 'pending' },
    })
    expect(validateAndRepair(badTarget)).toBe(true)
    expect(badTarget.imperial?.audit).toBeUndefined()
    expect(
      validateAndRepair(
        withImperial({
          ...base,
          audit: { week: 'w', targetId: 'imp_pass', deadline: -1, status: 'pending' },
        })
      )
    ).toBe(false)
    expect(
      validateAndRepair(
        withImperial({
          ...base,
          audit: { week: 'w', targetId: 'imp_pass', deadline: 1, status: 'bogus' },
        })
      )
    ).toBe(false)
    expect(
      validateAndRepair(
        withImperial({
          ...base,
          audit: { week: 'w', targetId: 'imp_pass', deadline: 1, status: 'pending', paid: 'no' },
        })
      )
    ).toBe(false)
  })
})
