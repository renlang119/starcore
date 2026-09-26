/**
 * encounters.ts — 随机遭遇事件 store（v1.26 可玩内容扩展方案 8）
 *
 * 职责：在线挂机的低频决策点。tick 掷骰触发、挂起待处理、过期静默消失、
 * 二选一即时结算（toast 回执由 UI 层消费返回值呈现）。
 *
 * 设计口径：
 * - 仅在线 tick 触发：离线补算路径不调用本 store；离线归来窗口已过的，
 *   回来首个 tick 弹一个（回来给惊喜，属设计）
 * - 同一时刻至多 1 个挂起事件；结算/过期后按 now 重开窗口
 * - 挂起 60 秒未处理自动失效，静默消失不代选（事件是增量惊喜不是任务）
 * - 本轮数据：挂起与冷却时间戳随转生清空，hardReset 同清；
 *   不加成就、不加终身计数
 * - 存档为可选字段零迁移：旧档缺 encounters 键视为无挂起、窗口重开；
 *   serialize 最小化（无挂起时整个字段不写，与旧档同构）
 *
 * 时间口径：挂起用绝对时间戳（pendingAt + 过期时限），冷却窗口用
 * nextTriggerAt 绝对时刻（触发即刻可判定，测试可预制旧值秒触）。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { EncountersSaveData } from '@/lib/storage'
import {
  ENCOUNTERS,
  ENCOUNTER_EXPIRE_MS,
  ENCOUNTER_IDS,
  ENCOUNTER_INTERVAL_MAX,
  ENCOUNTER_INTERVAL_MIN,
  getEncounter,
  rollOutcome,
  type EncounterDef,
  type EncounterRewards,
} from '@/data/encounters'

/** 掷骰通道（测试注入固定值；默认 Math.random）。事件选取、窗口间隔与结算掷骰共用 */
let randomProvider: () => number = Math.random
export function setEncounterRandomProvider(fn: () => number) {
  randomProvider = fn
}
function rollIntervalMs(): number {
  return (
    ENCOUNTER_INTERVAL_MIN * 1000 +
    randomProvider() * (ENCOUNTER_INTERVAL_MAX - ENCOUNTER_INTERVAL_MIN) * 1000
  )
}

/** 结算结果：选项命中的事件与资源变动（空对象 = 一无所获） */
export interface EncounterResolution {
  encounterId: string
  rewards: EncounterRewards
}
export const useEncountersStore = defineStore('encounters', () => {
  // —— state ——
  /** 挂起事件 id（空串 = 无挂起） */
  const pendingEventId = ref('')
  /** 挂起时刻（ms；pendingEventId 非空时有效） */
  const pendingAt = ref(0)
  /** 下次可触发时刻（ms；窗口计时锚。函数声明提升，初始化即用） */
  const nextTriggerAt = ref(Date.now() + rollInterval())
  /**
   * 最近一次结算（含结算时的事件名快照；AppShell watch 呈现回执 toast 用。
   * 结算回执与触发提醒共用全局 toast 单实例——resolve 清挂起会再触发
   * pendingEventId 的提醒 watch，此字段让回执后写覆盖提醒文案，不叠屏）
   */
  const lastResolution = ref<{ name: string; rewards: EncounterRewards } | null>(null)

  // —— getters ——
  const pendingEvent = computed<EncounterDef | undefined>(() =>
    pendingEventId.value ? getEncounter(pendingEventId.value) : undefined
  )

  /** 挂起是否已过期（60 秒未处理；tick 消费，UI 仅用于禁用态展示） */
  function isExpired(now = Date.now()): boolean {
    return pendingEventId.value !== '' && now - pendingAt.value > ENCOUNTER_EXPIRE_MS
  }

  /**
   * 每 tick 调用（仅在线路径；dt 秒不参与计时，全部用绝对时间戳）：
   * 1. 挂起已过期 → 静默失效，按 now 重开窗口
   * 2. 无挂起且到 nextTriggerAt → 掷一个事件挂起，挂起时刻 = now
   */
  function tick(now = Date.now()): void {
    if (pendingEventId.value !== '') {
      if (now - pendingAt.value > ENCOUNTER_EXPIRE_MS) {
        pendingEventId.value = ''
        pendingAt.value = 0
        nextTriggerAt.value = now + rollInterval()
      }
      return
    }
    if (now < nextTriggerAt.value) return
    const def = ENCOUNTERS[Math.floor(randomProvider() * ENCOUNTERS.length)]
    if (!def) return
    pendingEventId.value = def.id
    pendingAt.value = now
  }

  /** 下一次窗口间隔（ms）：均匀随机 [MIN, MAX]；经注入通道取随机，测试可固定 */
  function rollInterval(): number {
    return rollIntervalMs()
  }

  /**
   * 选择一个选项并即时结算：按分布掷结果，清挂起、重开窗口，返回结算结果。
   * 未知事件 id / 无挂起 / 已过期返回 null（UI 不应到达）。
   */
  function resolve(choice: 'A' | 'B', now = Date.now()): EncounterResolution | null {
    const def = pendingEvent.value
    if (!def) return null
    if (isExpired(now)) return null
    const opt = choice === 'A' ? def.optA : def.optB
    const rewards = rollOutcome(opt, randomProvider)
    pendingEventId.value = ''
    pendingAt.value = 0
    nextTriggerAt.value = now + rollInterval()
    // 事件名快照进 lastResolution（AppShell watch 呈现回执；后写覆盖触发提醒）
    lastResolution.value = { name: def.name, rewards }
    return { encounterId: def.id, rewards }
  }

  function reset(): void {
    pendingEventId.value = ''
    pendingAt.value = 0
    nextTriggerAt.value = Date.now() + rollInterval()
  }

  function serialize(): EncountersSaveData {
    // 最小化：无挂起不写 pending 键；窗口恒写（重启续窗口，防重载即触发）
    return {
      nextTriggerAt: nextTriggerAt.value,
      ...(pendingEventId.value
        ? { pendingEventId: pendingEventId.value, pendingAt: pendingAt.value }
        : {}),
    }
  }

  function hydrate(data: EncountersSaveData | undefined): void {
    if (!data) return
    if (
      typeof data.nextTriggerAt === 'number' &&
      Number.isFinite(data.nextTriggerAt) &&
      data.nextTriggerAt >= 0
    ) {
      nextTriggerAt.value = data.nextTriggerAt
    }
    // 挂起：仅认白名单 id；离线归来已过期的直接失效（不弹不代选），
    // 语义与 tick 过期一致——恢复现场时按当前时刻判一次
    if (
      typeof data.pendingEventId === 'string' &&
      ENCOUNTER_IDS.has(data.pendingEventId) &&
      typeof data.pendingAt === 'number' &&
      Number.isFinite(data.pendingAt) &&
      data.pendingAt >= 0
    ) {
      const now = Date.now()
      if (now - data.pendingAt <= ENCOUNTER_EXPIRE_MS) {
        pendingEventId.value = data.pendingEventId
        pendingAt.value = data.pendingAt
      }
    }
  }

  return {
    pendingEventId,
    pendingAt,
    nextTriggerAt,
    lastResolution,
    pendingEvent,
    isExpired,
    tick,
    resolve,
    reset,
    serialize,
    hydrate,
  }
})
