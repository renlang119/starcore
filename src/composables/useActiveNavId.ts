import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NAV_ITEMS } from '@/data/navigation'

/**
 * useActiveNavId — 当前路由对应的导航项 id（SideNav / BottomNav 共用，v1.07 收敛）
 *
 * 匹配不到（如战斗页 /battle/:id）返回 undefined：不高亮、不打 aria-current（v0.95）。
 */
export function useActiveNavId() {
  const route = useRoute()
  const activeId = computed(() => NAV_ITEMS.find((n) => n.path === route.path)?.id)
  /** 「更多」入口是否高亮：当前处于次级页面（BottomNav 用） */
  const moreActive = computed(() =>
    NAV_ITEMS.some((n) => n.tier === 'secondary' && n.path === route.path)
  )
  return { activeId, moreActive }
}
