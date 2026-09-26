/**
 * hydrate-noop.test.ts — 跨 store 的 hydrate(undefined) no-op 一致性
 *
 * 由 buildings/exploration/research/resources 四个 store 测试的同名同义用例
 * 合并而来（v1.04）：hydrate(undefined) 必须不改变现状，含已有内容的 store
 * 不被清空；daily / achievements 的 undefined 容缺仍留各自文件（daily 状态含周逻辑，故未并入）。
 */
import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { BUILDINGS } from '@/data/buildings'
import { useBuildingsStore } from '@/stores/buildings'
import { useExplorationStore } from '@/stores/exploration'
import { useResearchStore } from '@/stores/research'
import { useResourcesStore } from '@/stores/resources'

describe('stores — hydrate(undefined) 一致性', () => {
  it('hydrate(undefined) 不改变现状（四个 store 逐一验证）', () => {
    setActivePinia(createPinia())
    const buildings = useBuildingsStore()
    const exploration = useExplorationStore()
    const research = useResearchStore()
    const resources = useResourcesStore()
    research.complete('fusion_tech') // 有内容的 store：验证不被清空

    buildings.hydrate(undefined)
    exploration.hydrate(undefined)
    research.hydrate(undefined)
    resources.hydrate(undefined)

    expect(buildings.getLevel(BUILDINGS[0].id)).toBe(0)
    expect(exploration.count).toBe(0)
    expect(research.count).toBe(1)
    expect(resources.getAmount('energy').toNumber()).toBe(50)
  })
})
