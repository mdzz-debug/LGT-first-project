<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import * as echarts from 'echarts'
import mdi from '@iconify-json/mdi/icons.json'
import { useTheme } from '../composables/useTheme'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'

addCollection(mdi)

const router = useRouter()
const route = useRoute()
const { theme } = useTheme()

const navItems = [
  { label: '总览', path: '/dashboard', icon: 'mdi:view-dashboard-outline' },
  { label: '收支', path: '/ledger', icon: 'mdi:wallet-outline' },
  { label: '待办', path: '/tasks', icon: 'mdi:clipboard-check-outline' },
  { label: '习惯', path: '/habits', icon: 'mdi:leaf-outline' },
  { label: '洞察', path: '/stats', icon: 'mdi:chart-line' }
]


const currentName = ref('')
const greetingText = computed(() => {
  const hour = now.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 10) return '早安'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 22) return '晚上好'
  return '夜深了'
})

const loadCurrentUser = async () => {
  const cached = localStorage.getItem('pulse.user')
  if (cached) {
    try {
      const user = JSON.parse(cached)
      currentName.value = user.nickname || user.account || currentName.value
    } catch {
      // ignore
    }
  }
  try {
    const user = await apiFetch<any>('/users/me')
    currentName.value = user.nickname || user.account || currentName.value
  } catch {
    // ignore
  }
  if (!currentName.value) currentName.value = '朋友'
}

type Task = {
  id: string | number
  title: string
  category: string
  priority: 'P1' | 'P2' | 'P3'
  due: string
  startAt?: string
  endAt?: string
  dueDate?: string
  status?: number
  done: boolean
  icon: string
}

type LedgerItem = {
  id: string | number
  type: 'expense' | 'income'
  category: string
  amount: number
  date: string
  note: string
}


const tasks = ref<Task[]>([])

const ledgerRecords = ref<LedgerItem[]>([])

type UpcomingStatus = 'todo' | 'done' | 'overdue'

type UpcomingItem = {
  id: number | string
  time: string
  title: string
  icon: string
  date: string
  status: UpcomingStatus
  sourceType?: 'task' | 'habit'
  startAt?: string
  endAt?: string
}

const upcoming = ref<UpcomingItem[]>([])

const getTaskRange = (task: Task) => {
  const startDate = (task.startAt || task.dueDate || task.due || '').slice(0, 10)
  const endDate = (task.endAt || task.startAt || task.dueDate || task.due || '').slice(0, 10)
  return { startDate, endDate }
}

const resolveTaskStatus = (task: Task) => {
  if (task.status !== undefined) return task.status
  if (task.done) return 1
  const { endDate } = getTaskRange(task)
  if (endDate && endDate < todayKey.value) return 2
  return 0
}

const overview = ref({
  completionRate: 0,
  focusMinutes: 0,
  todoCount: 0,
  teamMembers: 0
})

const todayTasks = computed(() =>
  tasks.value.filter((task) => {
    const { startDate, endDate } = getTaskRange(task)
    if (!startDate || !endDate) return false
    if (startDate > todayKey.value || endDate < todayKey.value) return false
    return resolveTaskStatus(task) !== 2
  })
)

const completed = computed(() => todayTasks.value.filter((t) => resolveTaskStatus(t) === 1).length)
const inProgress = computed(() => todayTasks.value.filter((t) => resolveTaskStatus(t) === 0).length)
const completion = computed(() =>
  todayTasks.value.length
    ? Math.round((completed.value / todayTasks.value.length) * 100)
    : overview.value.completionRate
)
const focusMinutes = computed(() =>
  todayTasks.value.length ? completed.value * 25 : overview.value.focusMinutes
)

const fetchTasks = async () => {
  try {
    const data = await apiFetch<Task[]>('/dashboard/tasks')
    tasks.value = data.map((item: any) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      priority: item.priority,
      due: item.due_date ?? item.due,
      startAt: item.start_at || item.startAt,
      endAt: item.end_at || item.endAt,
      dueDate: item.due_date ?? item.due,
      status: typeof item.status === 'number' ? item.status : undefined,
      done: !!item.done,
      icon: item.icon || 'mdi:checkbox-marked-circle-outline'
    }))
  } catch {
    pushToast('任务加载失败', 'error')
  }
}

const fetchOverview = async () => {
  try {
    overview.value = await apiFetch('/dashboard/overview')
  } catch {
    // ignore
  }
}

const fetchLedgerRecords = async () => {
  try {
    const data = await apiFetch<any[]>('/ledger/records')
    ledgerRecords.value = data.map((item) => ({
      id: item.id,
      type: item.type,
      category: item.category || '其他',
      amount: Number(item.amount || 0),
      date: item.date,
      note: item.note || ''
    }))
  } catch {
    ledgerRecords.value = []
  }
}

const recentLedger = computed(() => ledgerRecords.value.slice(0, 5))
const todayExpense = computed(() =>
  ledgerRecords.value
    .filter((row) => row.type === 'expense' && row.date === todayKey.value)
    .reduce((sum, row) => sum + row.amount, 0)
)
const monthExpense = computed(() => {
  const monthKey = todayKey.value.slice(0, 7)
  return ledgerRecords.value
    .filter((row) => row.type === 'expense' && row.date.startsWith(monthKey))
    .reduce((sum, row) => sum + row.amount, 0)
})

const monthIncome = computed(() => {
  const monthKey = todayKey.value.slice(0, 7)
  return ledgerRecords.value
    .filter((row) => row.type === 'income' && row.date.startsWith(monthKey))
    .reduce((sum, row) => sum + row.amount, 0)
})

const monthNet = computed(() => monthIncome.value - monthExpense.value)

const flowChartRef = ref<HTMLDivElement | null>(null)
const donutChartRef = ref<HTMLDivElement | null>(null)
let flowChart: echarts.ECharts | null = null
let donutChart: echarts.ECharts | null = null

const getThemeTokens = () => {
  const styles = getComputedStyle(document.documentElement)
  return {
    text: styles.getPropertyValue('--text').trim() || '#0f172a',
    muted: styles.getPropertyValue('--text-muted').trim() || '#6b7280',
    primary: styles.getPropertyValue('--primary').trim() || '#4f8cff',
    accent: styles.getPropertyValue('--accent').trim() || '#a855f7',
    success: styles.getPropertyValue('--success').trim() || '#22c55e',
    border: styles.getPropertyValue('--border').trim() || 'rgba(148,163,184,0.2)',
    surface: styles.getPropertyValue('--surface').trim() || '#ffffff'
  }
}

const buildFlowSeries = () => {
  const labels: string[] = []
  const income: number[] = []
  const expense: number[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    const key = date.toISOString().slice(0, 10)
    labels.push(key.slice(5))
    const dayIncome = ledgerRecords.value
      .filter((row) => row.type === 'income' && row.date === key)
      .reduce((sum, row) => sum + row.amount, 0)
    const dayExpense = ledgerRecords.value
      .filter((row) => row.type === 'expense' && row.date === key)
      .reduce((sum, row) => sum + row.amount, 0)
    income.push(Number(dayIncome.toFixed(2)))
    expense.push(Number(dayExpense.toFixed(2)))
  }
  return { labels, income, expense }
}

const updateFlowChart = () => {
  if (!flowChartRef.value) return
  const tokens = getThemeTokens()
  if (!flowChart) {
    flowChart = echarts.init(flowChartRef.value)
  }
  const { labels, income, expense } = buildFlowSeries()
  flowChart.setOption({
    grid: { left: 8, right: 8, top: 10, bottom: 20, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.border } },
      axisLabel: { color: tokens.muted }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: tokens.border } },
      axisLabel: { color: tokens.muted }
    },
    series: [
      {
        name: '收入',
        type: 'line',
        data: income,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: tokens.primary },
        itemStyle: { color: tokens.primary }
      },
      {
        name: '支出',
        type: 'line',
        data: expense,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: tokens.accent },
        itemStyle: { color: tokens.accent }
      }
    ]
  })
}

const buildDonutData = () => {
  const monthKey = todayKey.value.slice(0, 7)
  const totals = new Map<string, number>()
  ledgerRecords.value
    .filter((row) => row.type === 'expense' && row.date.startsWith(monthKey))
    .forEach((row) => {
      totals.set(row.category, (totals.get(row.category) || 0) + row.amount)
    })
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 3)
  const rest = sorted.slice(3).reduce((sum, [, value]) => sum + value, 0)
  const data = top.map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
  if (rest > 0) data.push({ name: '其他', value: Number(rest.toFixed(2)) })
  return data.length ? data : [{ name: '暂无支出', value: 0.01 }]
}

const updateDonutChart = () => {
  if (!donutChartRef.value) return
  const tokens = getThemeTokens()
  if (!donutChart) {
    donutChart = echarts.init(donutChartRef.value)
  }
  const data = buildDonutData()
  donutChart.setOption({
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      textStyle: { color: tokens.muted, fontSize: 12 }
    },
    series: [
      {
        name: '本月支出',
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data
      }
    ]
  })
}

const updateCharts = () => {
  updateFlowChart()
  updateDonutChart()
}
const formatTimeRange = (startAt?: string, endAt?: string, time?: string) => {
  const start = startAt ? startAt.replace('T', ' ') : ''
  const end = endAt ? endAt.replace('T', ' ') : ''
  if (start && end) {
    const sameDay = start.slice(0, 10) === end.slice(0, 10)
    if (sameDay) {
      return `${start.slice(11, 16)} - ${end.slice(11, 16)}`
    }
    return `${start.slice(5, 16)} ~ ${end.slice(5, 16)}`
  }
  if (start) return start.slice(11, 16)
  if (time) return time
  return '全天'
}

const fetchUpcoming = async () => {
  try {
    const events = await apiFetch<any[]>('/calendar/events')
    upcoming.value = events.map((item) => {
      const sourceType = (item.source_type || item.sourceType) as UpcomingItem['sourceType']
      const icon =
        sourceType === 'task'
          ? 'mdi:checkbox-marked-circle-outline'
          : sourceType === 'habit'
            ? 'mdi:leaf-circle-outline'
            : item.icon || 'mdi:calendar-check'

      const startAt = item.start_at || item.startAt
      const endAt = item.end_at || item.endAt

      return {
        id: item.id,
        time: formatTimeRange(startAt, endAt, item.time),
        title: item.title,
        icon,
        date: item.date,
        status: (item.status || 'todo') as UpcomingStatus,
        sourceType,
        startAt,
        endAt
      }
    })
  } catch {
    // ignore
  }
}

const getUpcomingStatusLabel = (status: UpcomingStatus) => {
  if (status === 'done') return '已完成'
  if (status === 'overdue') return '逾期'
  return '待办'
}
const toLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const now = ref(new Date())
const todayKey = computed(() => toLocalDateKey(now.value))
let todayTimer: ReturnType<typeof setInterval> | null = null
const getItemRange = (item: UpcomingItem) => {
  const startDate = (item.startAt || item.date).slice(0, 10)
  const endDate = (item.endAt || item.startAt || item.date).slice(0, 10)
  return { startDate, endDate }
}

const resolveStatus = (item: UpcomingItem): UpcomingStatus => {
  if (item.status === 'done') return 'done'
  const { endDate } = getItemRange(item)
  if (endDate && endDate < todayKey.value) return 'overdue'
  return item.status || 'todo'
}

const todayItems = computed(() =>
  upcoming.value.filter((item) => {
    const { startDate, endDate } = getItemRange(item)
    if (!(startDate <= todayKey.value && endDate >= todayKey.value)) return false
    return resolveStatus(item) !== 'overdue'
  })
)

const mustTodayItems = computed(() =>
  todayItems.value.filter((item) => {
    const { startDate, endDate } = getItemRange(item)
    return startDate === todayKey.value && endDate === todayKey.value
  })
)

const coverTodayItems = computed(() =>
  todayItems.value.filter((item) => {
    const { startDate, endDate } = getItemRange(item)
    return !(startDate === todayKey.value && endDate === todayKey.value)
  })
)

const hasUpcomingSplit = computed(() =>
  mustTodayItems.value.length > 0 && coverTodayItems.value.length > 0
)

onMounted(async () => {
  if (typeof window === 'undefined') return

  todayTimer = window.setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)

  await Promise.all([loadCurrentUser(), fetchOverview(), fetchTasks(), fetchUpcoming(), fetchLedgerRecords()])
  await nextTick()
  updateCharts()
  window.addEventListener('resize', updateCharts)
})

watch([ledgerRecords, theme], () => {
  nextTick(updateCharts)
}, { deep: true })


onUnmounted(() => {
  if (todayTimer) {
    clearInterval(todayTimer)
    todayTimer = null
  }
  window.removeEventListener('resize', updateCharts)
  if (flowChart) {
    flowChart.dispose()
    flowChart = null
  }
  if (donutChart) {
    donutChart.dispose()
    donutChart = null
  }
})
</script>


<template>
  <div class="dashboard-layout">
    <aside class="dashboard-nav">
      <div class="nav-brand">
        <span class="logo-dot"></span>
        <span>PulseList</span>
      </div>
      <nav class="nav-items">
        <button
          v-for="item in navItems"
          :key="item.label"
          class="nav-item"
          :class="route.path === item.path && 'active'"
          @click="router.push(item.path)"
        >
          <Icon :icon="item.icon" />
        </button>
      </nav>
      <div class="nav-footer">
        <button class="nav-item" @click="router.push('/settings')">
          <Icon icon="mdi:cog-outline" />
        </button>
      </div>
    </aside>

    <div class="dashboard-content">
      <header class="dashboard-topbar">
        <div class="top-actions">
          <div class="theme-switch">
            <button class="chip" :class="theme === 'light' && 'active'" @click="theme = 'light'">浅色</button>
            <button class="chip" :class="theme === 'dark' && 'active'" @click="theme = 'dark'">暗黑</button>
            <button class="chip" :class="theme === 'warm' && 'active'" @click="theme = 'warm'">暖色</button>
          </div>
          <div class="user-chip">
            <span>Hi {{ currentName }}</span>
            <div class="avatar"></div>
          </div>
        </div>
      </header>

      <section class="dashboard-title">
        <div>
          <h1>总览面板 <span class="greeting">· {{ greetingText }}</span></h1>
          <p class="muted">今天共 {{ todayTasks.length }} 项待办，完成度 {{ completion }}%</p>
        </div>
      </section>

      <div class="dashboard-rows">
        <div class="dashboard-row">
          <div class="panel revenue-flow span-12">
            <div class="panel-head">
              <div>
                <h3>收支趋势</h3>
                <p class="muted">近 7 天趋势</p>
              </div>
            </div>
            <div class="flow-chart">
              <div ref="flowChartRef" class="flow-echart"></div>
            </div>
          </div>
        </div>

        <div class="dashboard-row">
          <div class="panel available span-6">
            <div class="panel-head">
              <h3>可用额度</h3>
            </div>
            <div class="available-body">
              <div class="donut-chart">
                <div ref="donutChartRef" class="donut-echart"></div>
                <div class="donut-center">
                  <p>本月支出</p>
                  <h4>¥ {{ monthExpense.toFixed(2) }}</h4>
                </div>
              </div>
            </div>
          </div>

          <div class="panel card-stack span-6">
            <div class="panel-head">
              <h3>资产概览</h3>
            </div>
            <div class="card-summary">
              <div class="balance">
                <p>本月结余</p>
                <h2>¥ {{ monthNet.toFixed(2) }}</h2>
                <p class="muted">今日支出 ¥ {{ todayExpense.toFixed(2) }}</p>
              </div>
              <div class="card-metrics">
                <div>
                  <p>本月收入</p>
                  <h4>¥ {{ monthIncome.toFixed(2) }}</h4>
                </div>
                <div>
                  <p>本月支出</p>
                  <h4>¥ {{ monthExpense.toFixed(2) }}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-row">
          <div class="panel summary span-12">
            <div class="panel-head">
              <div>
                <h3>收支摘要</h3>
                <div class="tx-legend">
                  <span><Icon icon="mdi:arrow-up" /> 收入</span>
                  <span><Icon icon="mdi:arrow-down" /> 支出</span>
                </div>
              </div>
              <button class="ghost" @click="router.push('/ledger')">查看全部</button>
            </div>
            <div class="summary-grid">
              <div class="summary-item income">
                <p>本月收入</p>
                <h3>¥ {{ monthIncome.toFixed(2) }}</h3>
              </div>
              <div class="summary-item expense">
                <p>本月支出</p>
                <h3>¥ {{ monthExpense.toFixed(2) }}</h3>
              </div>
            </div>
            <div class="summary-list">
              <div v-if="!recentLedger.length" class="empty-state">暂无记录</div>
              <ul v-else class="tx-list">
                <li v-for="item in recentLedger" :key="item.id" class="tx-item">
                  <div class="tx-icon" :class="item.type">
                    <Icon :icon="item.type === 'income' ? 'mdi:arrow-up' : 'mdi:arrow-down'" />
                  </div>
                  <div class="tx-body">
                    <div class="tx-title">{{ item.note || item.category }}</div>
                    <div class="tx-meta">{{ item.category }} · {{ item.date }}</div>
                  </div>
                  <div class="tx-amount" :class="item.type">
                    {{ item.type === 'income' ? '+' : '-' }}¥ {{ item.amount.toFixed(2) }}
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="dashboard-row">
          <div class="panel tasks span-6">
            <div class="panel-head">
              <div>
                <h3>今日任务</h3>
                <p class="muted">共 {{ todayTasks.length }} 项 · 已完成 {{ completed }} · 进行中 {{ inProgress }}</p>
              </div>
            </div>
            <ul class="task-list">
              <li v-for="task in todayTasks.slice(0, 5)" :key="task.id" class="task-item">
                <div class="task-icon">
                  <Icon :icon="task.icon" />
                </div>
                <div class="task-body">
                  <div class="task-title" :class="task.done && 'done'">{{ task.title }}</div>
                  <div class="task-meta">
                    <span class="tag">{{ task.category }}</span>
                    <span class="tag" :class="`priority-${task.priority}`">{{ task.priority }}</span>
                    <span class="tag">{{ task.due }}</span>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div class="panel schedule span-6">
            <div class="panel-head">
              <h3>日程</h3>
            </div>
            <div class="schedule-stats">
              <span>待办 {{ todayTasks.length }} 项</span>
              <span>专注 {{ focusMinutes }} min</span>
            </div>
            <div v-if="todayItems.length" class="schedule-list">
              <div
                v-for="item in todayItems.slice(0, 3)"
                :key="item.id"
                class="schedule-item"
              >
                <span class="schedule-status">{{ getUpcomingStatusLabel(resolveStatus(item)) }}</span>
                <span class="schedule-title">{{ item.title }}</span>
              </div>
              <div v-if="hasUpcomingSplit" class="muted">含跨日安排</div>
            </div>
            <div v-else class="muted">暂无安排</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



<style scoped>
.dashboard-layout {
  padding: 28px;
}

.dashboard-nav {
  background: color-mix(in srgb, var(--bg-1) 88%, transparent);
  border-radius: 24px;
  padding: 18px 10px;
  display: flex;
  position: fixed;
  top: 24px;
  left: 24px;
  width: 88px;
  height: calc(100vh - 48px);
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  z-index: 10;
  transform: translateZ(0);
}

.nav-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text);
}

.logo-dot {
  width: 36px;
  height: 36px;
  border-radius: 14px;
  background: linear-gradient(135deg, #31d0a0, #6ee7b7);
  box-shadow: 0 6px 18px rgba(49, 208, 160, 0.4);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: none;
  margin-top: 12px;
  align-items: center;
}

.nav-item {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--glass) 60%, transparent);
  display: grid;
  place-items: center;
  color: var(--text-muted);
  border: 1px solid transparent;
}


.nav-item .iconify {
  width: 22px;
  height: 22px;
}

.nav-item.active {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  color: var(--text);
  border-color: color-mix(in srgb, var(--primary) 35%, transparent);
  box-shadow: var(--shadow-soft);
}

.nav-footer {
  margin-top: auto;
}

.dashboard-content {
  display: grid;
  gap: 24px;
  margin-left: 128px;
}

.dashboard-rows {
  display: grid;
  gap: 20px;
}

.dashboard-row {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 18px;
}

.span-12 {
  grid-column: span 12;
}

.span-6 {
  grid-column: span 6;
}

.dashboard-topbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.theme-switch {
  display: flex;
  gap: 8px;
}

.theme-switch .chip {
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  color: var(--text);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
}

.user-chip .avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #38bdf8, #a78bfa);
}

.dashboard-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.dashboard-title h1 {
  font-size: 30px;
}

.filter-pills {
  display: flex;
  gap: 10px;
}

.pill {
  padding: 8px 18px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  color: var(--text);
}

.pill.active {
  background: rgba(49, 208, 160, 0.3);
  color: var(--text);
}


.panel {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  border-radius: 24px;
  padding: 18px;
  box-shadow: 0 20px 30px rgba(0, 0, 0, 0.25);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.revenue-flow {
  display: grid;
  gap: 16px;
}

.flow-chart {
  height: 220px;
}

.flow-echart {
  width: 100%;
  height: 220px;
}

.available {
  display: grid;
  gap: 16px;
}

.available-body {
  display: grid;
  place-items: center;
}


.donut-chart {
  position: relative;
  width: 220px;
  height: 220px;
  display: grid;
  place-items: center;
  margin: 0 auto;
}

.donut-echart {
  width: 220px;
  height: 220px;
}

.donut-center {
  position: absolute;
  text-align: center;
  pointer-events: none;
}
.tasks .task-list {
  margin-top: 12px;
  display: grid;
  gap: 12px;
}

.card-stack {
  background: linear-gradient(160deg, color-mix(in srgb, var(--primary) 30%, transparent), color-mix(in srgb, var(--bg-2) 90%, transparent));
  color: var(--text);
}

.card-summary {
  margin-top: 10px;
  padding: 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  display: grid;
  gap: 14px;
}

.card-summary .balance h2 {
  font-size: 26px;
}

.card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  font-size: 13px;
}

.card-metrics h4 {
  margin-top: 6px;
  font-weight: 600;
}

.tx-list {
  margin-top: 12px;
  display: grid;
  gap: 10px;
  list-style: none;
  padding: 0;
}


.tx-item {
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  padding: 10px 12px;
  border-radius: 14px;
}

.tx-body {
  display: grid;
  gap: 4px;
}

.tx-legend {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

.tx-legend .iconify {
  width: 14px;
  height: 14px;
}

.tx-amount {
  font-weight: 600;
}


.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 12px 0;
}

.summary-item {
  padding: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
}

.summary-item.income h3 {
  color: color-mix(in srgb, var(--success) 70%, var(--text));
}

.summary-item.expense h3 {
  color: color-mix(in srgb, var(--accent) 70%, var(--text));
}

.summary-list {
  margin-top: 8px;
}
@media (max-width: 1200px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
  .dashboard-nav {
    position: static;
    width: auto;
    height: auto;
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 18px;
  }
  .dashboard-content {
    margin-left: 0;
  }
  .nav-items {
    flex-direction: row;
    flex: none;
  }
  .dashboard-row {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }
  .span-6 {
    grid-column: span 12;
  }
  .span-12 {
    grid-column: span 12;
  }
  .available-body {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}
</style>
