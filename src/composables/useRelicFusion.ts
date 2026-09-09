/*
 * useRelicFusion — 遗物合成工坊的状态与动作
 *
 * 自 RelicView 拆出（v0.72）：选材点击发生在图鉴卡上，状态由视图层持有，
 * 合成面板（FusionPanel）通过 props/emit 与之桥接。
 * notify：提示消息注入口（稀有度混选等），由视图接入自己的 toast 实现。
 * 桥接约定：视图层经 props 把 owned 传给面板，composable 内只读 game store
 * 的_owned_数据做选材校验（v0.81 注记勘误：原注释「选材状态内聚于本文件」与
 * 实现不符——选材点击在图鉴卡，状态确实在本文件，但 owned 数据流经视图层）。
 */
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import type { RelicRarity } from '@/data/relics'
import type { OwnedRelic } from '@/stores/relics'

export function useRelicFusion(options: { notify?: (msg: string) => void } = {}) {
  const game = useGameStore()
  const notify = options.notify ?? (() => {})

  const selectedMaterials = ref<string[]>([])
  /** 选材模式开关：开启后图鉴卡点击=选材料 */
  const selectMode = ref(false)

  function toggleSelectMode() {
    selectMode.value = !selectMode.value
    if (!selectMode.value) clearSelection()
  }

  /** 是否可作为合成材料：未装备且非顶档 */
  function selectable(r: OwnedRelic): boolean {
    return !game.relics.isEquipped(r.instanceId) && r.rarity !== 'legendary'
  }

  function isMaterialSelected(r: OwnedRelic): boolean {
    return selectedMaterials.value.includes(r.instanceId)
  }

  function toggleMaterial(r: OwnedRelic) {
    if (!selectable(r)) return
    const i = selectedMaterials.value.indexOf(r.instanceId)
    if (i >= 0) {
      selectedMaterials.value.splice(i, 1)
      return
    }
    // 选中组内稀有度须一致（先选什么稀有度，后续只能加同档）
    if (selectedMaterials.value.length > 0 && materialRarity.value !== r.rarity) {
      notify('材料稀有度须一致')
      return
    }
    if (selectedMaterials.value.length < 3) selectedMaterials.value.push(r.instanceId)
  }

  /** 选中组的稀有度（0 或 3 件时有值；3 件必同稀有度，由 toggle 保证） */
  const materialRarity = computed<RelicRarity | null>(() => {
    if (selectedMaterials.value.length === 0) return null
    const first = game.relics.owned.find((r) => r.instanceId === selectedMaterials.value[0])
    return first?.rarity ?? null
  })

  /** 选中组内第 index 格（1 起）的材料名，未找到返回空串 */
  function materialName(index: number): string {
    return (
      game.relics.owned.find((r) => r.instanceId === selectedMaterials.value[index - 1])?.name ?? ''
    )
  }

  const canSynthesize = computed(() => {
    if (selectedMaterials.value.length !== 3) return false
    const mats = selectedMaterials.value
      .map((id) => game.relics.owned.find((r) => r.instanceId === id))
      .filter(Boolean) as OwnedRelic[]
    return mats.length === 3 && mats.every((m) => m.rarity === mats[0].rarity)
  })

  const synthResult = ref<OwnedRelic | null>(null)
  const synthFailMsg = ref('')

  function doSynthesize() {
    synthFailMsg.value = ''
    const result = game.relics.synthesize(selectedMaterials.value)
    if (result) {
      synthResult.value = result
      selectedMaterials.value = []
    } else {
      synthFailMsg.value = '合成失败：需 3 件未装备的同稀有度遗物'
    }
  }

  function clearSelection() {
    selectedMaterials.value = []
    synthFailMsg.value = ''
  }

  return {
    selectMode,
    selectedMaterials,
    materialRarity,
    canSynthesize,
    synthResult,
    synthFailMsg,
    toggleSelectMode,
    toggleMaterial,
    isMaterialSelected,
    selectable,
    clearSelection,
    doSynthesize,
    materialName,
  }
}

export type RelicFusionApi = ReturnType<typeof useRelicFusion>
