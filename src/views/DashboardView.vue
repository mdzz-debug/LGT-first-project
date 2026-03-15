<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import { useTheme } from '../composables/useTheme'
import CalendarModal, { type CalendarEvent } from '../components/CalendarModal.vue'
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

type Habit = {
  id: string | number
  name: string
  streak: number
  icon: string
  done: boolean
}

type LedgerItem = {
  id: string | number
  type: 'expense' | 'income'
  category: string
  amount: number
  date: string
  note: string
}

type PomodoroMode = 'focus' | 'short' | 'long'

type PomodoroSettings = {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
}

type PomodoroState = {
  mode: PomodoroMode
  status: 'idle' | 'running' | 'paused'
  secondsLeft: number
  completedRounds: number
}

const categories = ['家庭', '工作', '健康', '学习']
const priorities: Array<Task['priority']> = ['P1', 'P2', 'P3']

const tasks = ref<Task[]>([])

const habits = ref<Habit[]>([])

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

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done'>('all')
const priorityFilter = ref<'all' | Task['priority']>('all')
const modalOpen = ref(false)
const editingId = ref<string | number | null>(null)
const calendarOpen = shallowRef(false)
const form = ref<{
  title: string
  category: string
  priority: Task['priority']
  due: string
  icon: string
}>({
  title: '',
  category: categories[0] ?? '家庭',
  priority: priorities[1] ?? 'P2',
  due: '',
  icon: 'mdi:checkbox-marked-circle-outline'
})

const settingsKey = 'pulse.pomodoro.settings'
const stateKey = 'pulse.pomodoro.state'
const defaultSettings: PomodoroSettings = {
  focusMinutes: 30,
  shortBreakMinutes: 10,
  longBreakMinutes: 20,
  longBreakEvery: 4
}

const loadSettings = (): PomodoroSettings => {
  const raw = localStorage.getItem(settingsKey)
  if (!raw) {
    localStorage.setItem(settingsKey, JSON.stringify(defaultSettings))
    return defaultSettings
  }
  try {
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

const settings = ref(loadSettings())

const pomodoroOpen = ref(false)
const pomodoro = ref<PomodoroState>({
  mode: 'focus',
  status: 'idle',
  secondsLeft: settings.value.focusMinutes * 60,
  completedRounds: 0
})

let timer: ReturnType<typeof setInterval> | null = null

const persistState = () => {
  localStorage.setItem(stateKey, JSON.stringify(pomodoro.value))
  localStorage.setItem(settingsKey, JSON.stringify(settings.value))
}

const getDuration = (mode: PomodoroMode) => {
  if (mode === 'focus') return settings.value.focusMinutes
  if (mode === 'long') return settings.value.longBreakMinutes
  return settings.value.shortBreakMinutes
}

const resetPomodoro = () => {
  pomodoro.value = {
    mode: 'focus',
    status: 'idle',
    secondsLeft: settings.value.focusMinutes * 60,
    completedRounds: 0
  }
  persistState()
}

const startTimer = () => {
  if (timer) return
  timer = setInterval(() => {
    if (pomodoro.value.secondsLeft > 0) {
      pomodoro.value.secondsLeft -= 1
      persistState()
    } else {
      handlePhaseEnd()
    }
  }, 1000)
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const handlePhaseEnd = () => {
  stopTimer()
  if (pomodoro.value.mode === 'focus') {
    pomodoro.value.completedRounds += 1
    const isLong = pomodoro.value.completedRounds % settings.value.longBreakEvery === 0
    pomodoro.value.mode = isLong ? 'long' : 'short'
  } else {
    pomodoro.value.mode = 'focus'
  }
  pomodoro.value.secondsLeft = getDuration(pomodoro.value.mode) * 60
  pomodoro.value.status = 'running'
  startTimer()
  persistState()
}

const startPomodoro = () => {
  if (pomodoro.value.status === 'running') return
  if (pomodoro.value.secondsLeft <= 0) {
    pomodoro.value.secondsLeft = getDuration(pomodoro.value.mode) * 60
  }
  pomodoro.value.status = 'running'
  startTimer()
  persistState()
}

const pausePomodoro = () => {
  pomodoro.value.status = 'paused'
  stopTimer()
  persistState()
}

const stopPomodoro = () => {
  stopTimer()
  resetPomodoro()
}

const skipPhase = () => {
  if (pomodoro.value.mode !== 'focus') {
    pomodoro.value.mode = 'focus'
    pomodoro.value.secondsLeft = getDuration('focus') * 60
    pomodoro.value.status = 'running'
    startTimer()
    persistState()
  }
}

const openPomodoro = () => {
  pomodoroOpen.value = true
  if (pomodoro.value.status === 'idle') {
    pomodoro.value.secondsLeft = getDuration('focus') * 60
    persistState()
  }
}

const closePomodoro = () => {
  pomodoroOpen.value = false
}

const formattedTime = computed(() => {
  const total = pomodoro.value.secondsLeft
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const modeLabel = computed(() => {
  if (pomodoro.value.mode === 'focus') return '专注'
  if (pomodoro.value.mode === 'long') return '长休息'
  return '短休息'
})

const roundLabel = computed(() => {
  const current = pomodoro.value.mode === 'focus'
    ? pomodoro.value.completedRounds + 1
    : pomodoro.value.completedRounds
  return `第 ${current} / ${settings.value.longBreakEvery} 轮`
})

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

const todayTasks = computed(() =>
  tasks.value.filter((task) => {
    const { startDate, endDate } = getTaskRange(task)
    if (!startDate || !endDate) return false
    if (startDate > todayKey.value || endDate < todayKey.value) return false
    return resolveTaskStatus(task) !== 2
  })
)

const filteredTasks = computed(() => {
  return todayTasks.value.filter((task) => {
    const hitQuery = task.title.includes(query.value.trim())
    const status = resolveTaskStatus(task)
    const hitStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'done' ? status === 1 : status === 0)
    const hitPriority =
      priorityFilter.value === 'all' || task.priority === priorityFilter.value
    return hitQuery && hitStatus && hitPriority
  })
})

const overview = ref({
  completionRate: 0,
  focusMinutes: 0,
  todoCount: 0,
  teamMembers: 0
})

const completed = computed(() => todayTasks.value.filter((t) => resolveTaskStatus(t) === 1).length)
const completion = computed(() =>
  todayTasks.value.length
    ? Math.round((completed.value / todayTasks.value.length) * 100)
    : overview.value.completionRate
)
const focusMinutes = computed(() =>
  todayTasks.value.length ? completed.value * 25 : overview.value.focusMinutes
)
const inProgress = computed(() =>
  todayTasks.value.filter((t) => resolveTaskStatus(t) === 0).length
)

const toggleDone = async (task: Task) => {
  task.done = !task.done
  try {
    await apiFetch(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: { done: task.done }
    })
    await fetchOverview()
  } catch {
    pushToast('任务状态更新失败', 'error')
  }
}



const openCreate = () => {
  editingId.value = null
  form.value = {
    title: '',
    category: categories[0] ?? '家庭',
    priority: priorities[1] ?? 'P2',
    due: '',
    icon: 'mdi:checkbox-marked-circle-outline'
  }
  modalOpen.value = true
}

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

const fetchHabits = async () => {
  try {
    const data = await apiFetch<any[]>('/habits')
    habits.value = data.slice(0, 4).map((h) => ({
      id: h.id,
      name: h.name,
      streak: Number(h.streak || 0),
      icon: h.icon || 'mdi:check-circle-outline',
      done: !!h.done
    }))
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
const today支出 = computed(() =>
  ledgerRecords.value
    .filter((row) => row.type === 'expense' && row.date === todayKey.value)
    .reduce((sum, row) => sum + row.amount, 0)
)
const month支出 = computed(() => {
  const monthKey = todayKey.value.slice(0, 7)
  return ledgerRecords.value
    .filter((row) => row.type === 'expense' && row.date.startsWith(monthKey))
    .reduce((sum, row) => sum + row.amount, 0)
})

const flowBars = computed(() => {
  const base = [28, 18, 24, 16, 30, 22, 26, 20]
  const max = Math.max(...base)
  return base.map((value, idx) => ({
    id: idx,
    value,
    height: Math.round((value / max) * 100)
  }))
})

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

const openEdit = (task: Task) => {
  editingId.value = task.id
  form.value = {
    title: task.title,
    category: task.category,
    priority: task.priority,
    due: task.due,
    icon: task.icon
  }
  modalOpen.value = true
}

const saveTask = async () => {
  if (!form.value.title.trim()) return
  try {
    if (editingId.value) {
      await apiFetch(`/tasks/${editingId.value}`, {
        method: 'PATCH',
        body: {
          title: form.value.title,
          category: form.value.category,
          priority: form.value.priority,
          due: form.value.due,
          icon: form.value.icon
        }
      })
    } else {
      await apiFetch('/tasks', {
        method: 'POST',
        body: {
          title: form.value.title,
          category: form.value.category,
          priority: form.value.priority,
          due: form.value.due,
          icon: form.value.icon
        }
      })
    }
    await fetchTasks()
  } catch {
    // ignore
  }
  modalOpen.value = false
}

const removeTask = async (id: string | number) => {
  try {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' })
    await fetchTasks()
  } catch {
    // ignore
  }
}

const goWeeklyReport = () => {
  router.push('/stats')
}

const openCalendar = () => {
  calendarOpen.value = true
}

const getUpcomingStatusLabel = (status: UpcomingStatus) => {
  if (status === 'done') return '已完成'
  if (status === 'overdue') return '逾期'
  return '待办'
}

const toggleUpcomingStatus = async (item: UpcomingItem) => {
  item.status = item.status === 'done' ? 'todo' : 'done'
  try {
    await apiFetch(`/calendar/events/${item.id}`, {
      method: 'PATCH',
      body: {
        status: item.status
      }
    })
  } catch {
    // ignore
  }
}

const calendarEvents = computed<CalendarEvent[]>(() =>
  upcoming.value.map((item) => ({
    date: item.date,
    title: item.title,
    time: item.time,
    status: resolveStatus(item),
    sourceType: item.sourceType,
    startAt: item.startAt,
    endAt: item.endAt
  }))
)

const toLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const now = shallowRef(new Date())
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
  const params = new URLSearchParams(window.location.search)
  if (params.get('pomodoro') === '1') {
    openPomodoro()
  }
  if (params.get('calendar') === '1') {
    calendarOpen.value = true
  }

  todayTimer = window.setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)

  await Promise.all([loadCurrentUser(), fetchOverview(), fetchTasks(), fetchHabits(), fetchUpcoming(), fetchLedgerRecords()])
})

onUnmounted(() => {
  if (todayTimer) {
    clearInterval(todayTimer)
    todayTimer = null
  }
  stopTimer()
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
          :key="item.path"
          class="nav-item"
          :class="route.path === item.path && 'active'"
          @click="router.push(item.path)"
        >
          <Icon :icon="item.icon" />
        </button>
      </nav>
      <div class="nav-footer">
        <button class="nav-item">
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

      <div class="dashboard-grid">
        <section class="dashboard-main">
          <div class="panel revenue-flow">
            <div class="panel-head">
              <div>
                <h3>收支趋势</h3>
                <p class="muted">现金流趋势 · 示例走势</p>
              </div>
              <button class="ghost" @click="goWeeklyReport">查看全部</button>
            </div>
            <div class="flow-chart">
              <div v-for="bar in flowBars" :key="bar.id" class="flow-bar">
                <span :style="{ height: bar.height + '%' }"></span>
              </div>
            </div>
          </div>

          <div class="panel available">
            <div class="panel-head">
              <h3>可用额度</h3>
              <button class="ghost">查看全部</button>
            </div>
            <div class="available-body">
              <div class="donut">
                <div class="donut-center">
                  <p>Total 支出s</p>
                  <h4>¥ {{ month支出.toFixed(2) }}</h4>
                </div>
              </div>
              <div class="donut-legend">
                <div><span class="legend-dot food"></span> 餐饮</div>
                <div><span class="legend-dot home"></span> 居家</div>
                <div><span class="legend-dot other"></span> 其他</div>
              </div>
            </div>
          </div>

          <div class="panel income-card">
            <h4>收入</h4>
            <h2>¥ {{ (month支出 * 1.12).toFixed(2) }}</h2>
            <p class="muted">本周收入</p>
          </div>

          <div class="panel expense-card">
            <h4>支出</h4>
            <h2>¥ {{ month支出.toFixed(2) }}</h2>
            <p class="muted">本周支出</p>
          </div>

          <div class="panel tasks">
            <div class="panel-head">
              <div>
                <h3>今日任务</h3>
                <p class="muted">共 {{ todayTasks.length }} 项 · 已完成 {{ completed }} · 进行中 {{ inProgress }}</p>
              </div>
              <button class="primary" @click="openCreate">新建任务</button>
            </div>
            <ul class="task-list">
              <li v-for="task in filteredTasks" :key="task.id" class="task-item">
                <div class="task-icon" @click="toggleDone(task)">
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
                <div class="task-actions">
                  <button class="ghost" @click="openEdit(task)">编辑</button>
                  <button class="ghost danger" @click="removeTask(task.id)">删除</button>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <aside class="dashboard-right">
          <div class="panel card-stack">
            <div class="panel-head">
              <h3>我的卡片</h3>
              <button class="ghost">查看全部</button>
            </div>
            <div class="card-preview">
              <p>账户余额</p>
              <h2>¥ {{ (month支出 * 3.2 + 1280).toFixed(2) }}</h2>
              <p class="muted">今日支出 ¥ {{ today支出.toFixed(2) }}</p>
              <div class="card-row">
                <span>**** 2323</span>
                <span>08/24</span>
              </div>
            </div>
          </div>

          <div class="panel transactions">
            <div class="panel-head">
              <h3>交易记录</h3>
              <button class="ghost" @click="router.push('/ledger')">查看全部</button>
            </div>
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

          

          <div class="panel schedule">
            <div class="panel-head">
              <h3>日程</h3>
              <button class="ghost" @click="openCalendar">日历</button>
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
                @click="toggleUpcomingStatus(item)"
              >
                <span class="schedule-status">{{ getUpcomingStatusLabel(resolveStatus(item)) }}</span>
                <span class="schedule-title">{{ item.title }}</span>
              </div>
              <div v-if="hasUpcomingSplit" class="muted">含跨日安排</div>
            </div>
            <div v-else class="muted">暂无安排</div>
            <button class="primary" @click="openPomodoro">开始专注</button>
          </div>
        </aside>
      </div>
    </div>

    <Transition name="backdrop-fade">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>{{ editingId ? '编辑任务' : '新建任务' }}</h3>
            <button class="ghost" @click="modalOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <label>
              <span>标题</span>
              <input v-model="form.title" placeholder="请输入任务标题" />
            </label>
            <label>
              <span>分类</span>
              <select v-model="form.category">
                <option v-for="item in categories" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select v-model="form.priority">
                <option v-for="item in priorities" :key="item" :value="item">{{ item }}</option>
              </select>
            </label>
            <label>
              <span>截止</span>
              <input v-model="form.due" placeholder="例如：今天 18:00" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="modalOpen = false">取消</button>
            <button class="primary" @click="saveTask">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="backdrop-fade">
      <div v-if="pomodoroOpen" class="pomodoro-backdrop" @click.self="closePomodoro">
        <div class="pomodoro">
          <button class="pomodoro-exit ghost" @click="closePomodoro">退出</button>

          <div class="pomodoro-center">
            <div class="pomodoro-ring">
              <div class="pomodoro-time">{{ formattedTime }}</div>
              <div class="pomodoro-meta">
                <span class="kicker">沉浸专注</span>
                <span class="mode">{{ modeLabel }} · {{ roundLabel }}</span>
              </div>
            </div>
            <p class="muted">默认 30 分钟 / 10 分钟休息 / 每 4 轮</p>
          </div>

          <div class="pomodoro-actions">
            <button class="primary" @click="startPomodoro" v-if="pomodoro.status !== 'running'">开始</button>
            <button class="ghost" @click="pausePomodoro" v-else>暂停</button>
            <button class="ghost" @click="stopPomodoro">结束</button>
            <button class="ghost" @click="skipPhase" v-if="pomodoro.mode !== 'focus'">跳过休息</button>
          </div>

          <div class="music-box">
            <div>
              <h4>音乐接入预留</h4>
              <p class="muted">后续接入外部播放器 / 白噪音 / 个人歌单</p>
            </div>
            <div class="music-controls">
              <button class="ghost">上一首</button>
              <button class="ghost">播放</button>
              <button class="ghost">下一首</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <CalendarModal :open="calendarOpen" :events="calendarEvents" @close="calendarOpen = false" />
  </div>
</template>


<style scoped>
.dashboard-layout {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
}

.dashboard-nav {
  background: color-mix(in srgb, var(--bg-1) 88%, transparent);
  border-radius: 24px;
  padding: 18px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
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
}

.dashboard-main {
  display: grid;
  gap: 18px;
}

.dashboard-right {
  display: grid;
  gap: 18px;
}

.dashboard-topbar {
  display: flex;
  justify-content: space-between;
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

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 28px;
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
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  height: 180px;
  align-items: end;
}

.flow-bar span {
  display: block;
  width: 100%;
  border-radius: 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 70%, transparent), color-mix(in srgb, var(--accent) 40%, transparent));
  box-shadow: 0 10px 20px color-mix(in srgb, var(--primary) 25%, transparent);
}

.available {
  display: grid;
  gap: 16px;
}

.available-body {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  gap: 16px;
}

.donut {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: conic-gradient(color-mix(in srgb, var(--success) 70%, transparent) 0 40%, color-mix(in srgb, var(--accent) 60%, transparent) 40% 70%, color-mix(in srgb, var(--primary) 60%, transparent) 70% 100%);
  display: grid;
  place-items: center;
  position: relative;
}

.donut::after {
  content: '';
  width: 110px;
  height: 110px;
  background: color-mix(in srgb, var(--bg-1) 80%, transparent);
  border-radius: 50%;
  position: absolute;
}

.donut-center {
  position: relative;
  z-index: 1;
  text-align: center;
}

.donut-legend {
  display: grid;
  gap: 10px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}

.legend-dot.food { background: #6ee7b7; }
.legend-dot.home { background: #a78bfa; }
.legend-dot.other { background: #38bdf8; }

.income-card, .expense-card {
  display: grid;
  gap: 8px;
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

.card-preview {
  margin-top: 10px;
  padding: 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
}

.card-row {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 12px;
}

.transactions .tx-list {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}


.transactions .tx-item {
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  padding: 10px 12px;
  border-radius: 14px;
}

.transactions .tx-body {
  display: grid;
  gap: 4px;
}

.transactions .tx-amount {
  font-weight: 600;
}

@media (max-width: 1200px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
  .dashboard-nav {
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 18px;
  }
  .nav-items {
    flex-direction: row;
    flex: none;
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .available-body {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}
</style>
