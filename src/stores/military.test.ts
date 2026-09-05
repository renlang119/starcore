/**
 * military.test.ts — 训练并行槽位（v0.48）
 * 基础 1 槽，科技「集群操练 I/II」各 +1，上限 3；满槽拒绝入队，队列中任务不受影响
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useMilitaryStore,
  setTrainingSlotProvider,
  BASE_TRAINING_SLOTS,
  MAX_TRAINING_SLOTS,
} from './military'
import { TECHS } from '@/data/tech'

const afford = () => true

describe('military store · 训练并行槽', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // provider 是模块级状态，每个用例重置为基础槽位
    setTrainingSlotProvider(() => BASE_TRAINING_SLOTS)
  })

  it('默认 1 槽：第二个任务被拒绝且不扣费', () => {
    const m = useMilitaryStore()
    const spend = vi.fn(() => true)
    expect(m.maxTrainingSlots).toBe(1)
    expect(m.startTraining('assault', 1, afford, spend)).toBe(true)
    expect(m.startTraining('assault', 1, afford, spend)).toBe(false)
    expect(spend).toHaveBeenCalledTimes(1)
    expect(m.trainingQueue.length).toBe(1)
  })

  it('科技加成扩容：2 槽可同时排 2 个任务', () => {
    setTrainingSlotProvider(() => 2)
    const m = useMilitaryStore()
    expect(m.maxTrainingSlots).toBe(2)
    expect(m.startTraining('assault', 1, afford, afford)).toBe(true)
    expect(m.startTraining('guard', 1, afford, afford)).toBe(true)
    expect(m.startTraining('assault', 1, afford, afford)).toBe(false)
    expect(m.trainingQueue.length).toBe(2)
  })

  it('槽位封顶 3：provider 超上限仍按 3 计', () => {
    setTrainingSlotProvider(() => 99)
    const m = useMilitaryStore()
    expect(m.maxTrainingSlots).toBe(MAX_TRAINING_SLOTS)
  })

  it('任务完成后槽位释放，可再次入队', () => {
    const m = useMilitaryStore()
    m.startTraining('assault', 1, afford, afford)
    m.applyTick(9999) // 直接跑完
    expect(m.trainingQueue.length).toBe(0)
    expect(m.getOwned('assault')).toBe(1)
    expect(m.startTraining('assault', 1, afford, afford)).toBe(true)
  })

  it('旧档兼容：hydrate 超槽任务继续跑完，仅限制新入队', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
      training: [
        { id: 't1', unitId: 'assault', count: 1, remaining: 5, totalTime: 5 },
        { id: 't2', unitId: 'guard', count: 2, remaining: 5, totalTime: 5 },
        { id: 't3', unitId: 'heavy', count: 1, remaining: 5, totalTime: 5 },
      ],
      formations: [],
    })
    // 超出当前 1 槽：新任务被拒，但旧任务照常完成
    expect(m.startTraining('assault', 1, afford, afford)).toBe(false)
    const done = m.applyTick(10)
    expect(done).toEqual({ assault: 1, guard: 2, heavy: 1 })
    expect(m.trainingQueue.length).toBe(0)
  })
})

describe('集群操练科技数据契约', () => {
  it('两个科技各 +1 槽，顺序解锁（I → II）', () => {
    const t1 = TECHS.find((t) => t.id === 'parallel_training_1')
    const t2 = TECHS.find((t) => t.id === 'parallel_training_2')
    expect(t1?.effects).toEqual([{ type: 'training_slot', value: 1, label: '训练并行槽 +1' }])
    expect(t2?.effects).toEqual([{ type: 'training_slot', value: 1, label: '训练并行槽 +1' }])
    expect(t1?.requires).toEqual(['military_basic'])
    expect(t2?.requires).toEqual(['parallel_training_1'])
    // 基础 1 + I + II = 上限 3
    expect(BASE_TRAINING_SLOTS + 1 + 1).toBe(MAX_TRAINING_SLOTS)
  })
})
