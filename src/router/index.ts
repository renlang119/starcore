import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '主界面', tab: true } },
  { path: '/build', name: 'build', component: () => import('@/views/BuildView.vue'), meta: { title: '建造', tab: true } },
  { path: '/tech', name: 'tech', component: () => import('@/views/TechView.vue'), meta: { title: '科技树', tab: true } },
  { path: '/map', name: 'map', component: () => import('@/views/MapView.vue'), meta: { title: '探索', tab: true } },
  { path: '/army', name: 'army', component: () => import('@/views/ArmyView.vue'), meta: { title: '部队', tab: true } },
  { path: '/relic', name: 'relic', component: () => import('@/views/RelicView.vue'), meta: { title: '遗物', tab: false } },
  { path: '/prestige', name: 'prestige', component: () => import('@/views/PrestigeView.vue'), meta: { title: '奇点重启', tab: false } },
  { path: '/battle/:id', name: 'battle', component: () => import('@/views/BattleView.vue'), meta: { title: '战斗出征', tab: false } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})

export default router
