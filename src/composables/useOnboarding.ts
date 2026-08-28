/**
 * useOnboarding.ts — P3-3 新手引导气泡
 *
 * 功能：
 * - localStorage 持久化已完成的 step
 * - 10s 超时自动 dismiss
 * - 支持 dismiss / skipAll
 *
 * 用法：
 *   const { activeStep, dismiss, skipAll } = useOnboarding('home')
 *   // activeStep.value === 'step1' 时显示气泡
 */
import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'sc_onboarding_v1'
const TIMEOUT_MS = 10_000

/** 所有引导流程 ID */
export type OnboardingFlow = 'home' | 'build' | 'tech' | 'map' | 'army'

/** 已完成 step 集合（跨页面共享） */
function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function saveCompleted(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

/**
 * 使用引导流程
 * @param flow 流程 ID
 * @param steps 该流程的 step ID 列表（按顺序）
 * @returns activeStep — 当前应显示的 step（null 表示不显示）
 */
export function useOnboarding(_flow: OnboardingFlow, steps: string[]) {
  const activeStep = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function startTimeout() {
    clearTimer()
    timer = setTimeout(() => {
      activeStep.value = null
    }, TIMEOUT_MS)
  }

  /** 标记当前 step 完成，自动推进到下一个 */
  function dismiss() {
    if (activeStep.value) {
      const completed = loadCompleted()
      completed.add(activeStep.value)
      saveCompleted(completed)
    }
    clearTimer()
    // 推进到下一个未完成的 step
    const completed = loadCompleted()
    const next = steps.find((s) => !completed.has(s))
    activeStep.value = next ?? null
    if (activeStep.value) startTimeout()
  }

  /** 跳过整个流程 */
  function skipAll() {
    const completed = loadCompleted()
    for (const s of steps) completed.add(s)
    saveCompleted(completed)
    clearTimer()
    activeStep.value = null
  }

  onMounted(() => {
    const completed = loadCompleted()
    const next = steps.find((s) => !completed.has(s))
    if (next) {
      activeStep.value = next
      startTimeout()
    }
  })

  onUnmounted(() => {
    clearTimer()
  })

  return { activeStep, dismiss, skipAll }
}
