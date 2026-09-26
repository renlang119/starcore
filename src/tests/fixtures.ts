/**
 * fixtures.ts — 跨文件存档/状态工厂（v1.04 收敛）
 *
 * makeSaveData：全字段合法存档（storage 导出/导入往返用）。
 * minimalSaveData：通用极简合法存档工厂（按需覆盖顶层字段）；resources 只含
 *   energy 键即可过校验器——校验只查值形态不查键齐全）。
 * exploredNodes：把一组节点构造为「已完成」并 hydrate 进 exploration store。
 */
import type { SaveData } from '@/lib/storage'
import { useExplorationStore } from '@/stores/exploration'

/** 全字段合法存档 */
export function makeSaveData(): SaveData {
  return {
    version: 1,
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

/** 极简合法存档（按需覆盖顶层字段） */
export function minimalSaveData(over?: Partial<SaveData>): SaveData {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'p1', name: '指挥官' },
    totalPlayTime: 0,
    resources: { amounts: { energy: '100' }, totals: { energy: '100' } },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    ...over,
  }
}

/** 把一组节点构造为「已完成」并 hydrate（探索完成态的唯一构造口） */
export function exploredNodes(...nodeIds: string[]): void {
  const exploration = useExplorationStore()
  const progress: Record<
    string,
    { nodeId: string; startTime: number; endTime: number; completed: boolean }
  > = {}
  for (const id of nodeIds) {
    progress[id] = { nodeId: id, startTime: 0, endTime: 0, completed: true }
  }
  exploration.hydrate({ progress })
}
