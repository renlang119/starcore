import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { wide: true },
  },
  { path: '/build', name: 'build', component: () => import('@/views/BuildView.vue') },
  { path: '/tech', name: 'tech', component: () => import('@/views/TechView.vue') },
  { path: '/map', name: 'map', component: () => import('@/views/MapView.vue') },
  { path: '/army', name: 'army', component: () => import('@/views/ArmyView.vue') },
  { path: '/relic', name: 'relic', component: () => import('@/views/RelicView.vue') },
  { path: '/prestige', name: 'prestige', component: () => import('@/views/PrestigeView.vue') },
  {
    path: '/achievements',
    name: 'achievements',
    component: () => import('@/views/AchievementsView.vue'),
  },
  { path: '/battle/:id', name: 'battle', component: () => import('@/views/BattleView.vue') },
  // 未知路径兜底：重定向首页（防空白页无出口，v0.77）
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
