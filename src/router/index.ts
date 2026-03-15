import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import TasksView from '../views/TasksView.vue'
import HabitsView from '../views/HabitsView.vue'
import LedgerView from '../views/LedgerView.vue'
import StatsView from '../views/StatsView.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: LoginView, meta: { guest: true } },
  { path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/tasks', component: TasksView, meta: { requiresAuth: true } },
  { path: '/habits', component: HabitsView, meta: { requiresAuth: true } },
  { path: '/ledger', component: LedgerView, meta: { requiresAuth: true } },
  { path: '/stats', component: StatsView, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { left: 0, top: 0 }
  }
})

router.beforeEach((to) => {
  const token = localStorage.getItem('pulse.token')
  if (to.meta.requiresAuth && !token) return { path: '/login' }
  if (to.meta.guest && token) return { path: '/dashboard' }
  return true
})

export default router
