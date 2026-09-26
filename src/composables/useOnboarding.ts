/**
 * useOnboarding.ts — 新手引导气泡
 *
 * 功能：
 * - localStorage 持久化已完成的 step
 * - 10s 超时自动隐藏（只隐藏不标记完成，再次进入仍提示，直到 dismiss/skipAll）
 * - 支持 dismiss / skipAll
 *
 * 用法：
 *   const { activeStep, dismiss, skipAll } = useOnboarding(['step1', 'step2'])
 *   // activeStep.value === 'step1' 时显示气泡
 */
import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'starcore_onboarding'
const TIMEOUT_MS = 10_000

/** 已完成 step 集合（跨页面共享）
 *  存储结构（体验增强设计规范 §3.3.4）：JSON 对象，每个 step 一个 boolean，
 *  `state[stepId] === true` 表示已 dismiss */
function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const obj = JSON.parse(raw) as Record<string, boolean>
    return new Set(Object.keys(obj).filter((k) => obj[k] === true))
  } catch {
    return new Set()
  }
}

function saveCompleted(set: Set<string>) {
  try {
    const obj: Record<string, boolean> = {}
    for (const s of set) obj[s] = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // ignore
  }
}

/**
 * 使用引导流程（各流程共享同一存储 key；按步骤区分，无需流程参数）
 * @param steps 该流程的 step ID 列表（按顺序）
 * @returns activeStep — 当前应显示的 step（null 表示不显示）
 */
export function useOnboarding(steps: string[]) {
  const activeStep = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  // 超时只隐藏气泡（activeStep = null），不写入 completed：
  // 玩家切走再回来仍会看到提示，直到主动 dismiss/skipAll 才记为完成
  function startTimeout() {
    clearTimer()
    timer = setTimeout(() => {
      activeStep.value = null
    }, TIMEOUT_MS)
  }

  /** 标记当前 step 完成，自动推进到下一个 */
  function dismiss() {
    const completed = loadCompleted()
    if (activeStep.value) {
      completed.add(activeStep.value)
      saveCompleted(completed)
    }
    clearTimer()
    // 推进到下一个未完成的 step（复用上面读取的集合）
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
