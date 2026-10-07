import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    // wide：首页双列宽内容；hideTopResources：首页 hero 五资源节点已完整呈现资源信息，
    // 顶栏资源条隐藏（其他页面照常显示，v1.43）
    meta: { wide: true, hideTopResources: true },
  },
  { path: '/build', name: 'build', component: () => import('@/views/BuildView.vue') },
  {
    path: '/tech',
    name: 'tech',
    component: () => import('@/views/TechView.vue'),
    meta: { grid: true },
  },
  { path: '/map', name: 'map', component: () => import('@/views/MapView.vue') },
  { path: '/army', name: 'army', component: () => import('@/views/ArmyView.vue') },
  { path: '/relic', name: 'relic', component: () => import('@/views/RelicView.vue') },
  { path: '/prestige', name: 'prestige', component: () => import('@/views/PrestigeView.vue') },
  {
    path: '/achievements',
    name: 'achievements',
    component: () => import('@/views/AchievementsView.vue'),
    meta: { grid: true },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('@/views/ArchiveView.vue'),
    meta: { grid: true },
  },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/battle/:id', name: 'battle', component: () => import('@/views/BattleView.vue') },
  // 未知路径兜底：重定向首页（防空白页无出口，v0.77）
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    // 前进/后退恢复滚动位置，其余导航回顶
    return savedPosition ?? { top: 0 }
  },
})

export default router
