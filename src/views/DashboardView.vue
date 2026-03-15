<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'
import CalendarModal, { type CalendarEvent } from '../components/CalendarModal.vue'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'

addCollection(mdi)

const router = useRouter()

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

const toggleHabitCheck = async (habit: Habit) => {
  const nextDone = !habit.done
  habit.done = nextDone
  habit.streak = habit.done ? habit.streak + 1 : Math.max(habit.streak - 1, 0)
  try {
    await apiFetch(`/habits/${habit.id}`, {
      method: 'PATCH',
      body: {
        done: nextDone
      }
    })
  } catch {
    pushToast('习惯状态更新失败', 'error')
  }
}

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

const goHabits = () => {
  router.push('/habits')
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
  <div class="page dashboard-v2">
    <AppHeader />

    <main class="dash-shell">
      <header class="dash-top">
        <div class="dash-title">
          <p class="eyebrow">My Dashboard</p>
          <h1>{{ greetingText }}，{{ currentName }}</h1>
          <p class="muted">用财务节奏与任务优先级校准今天的行动。</p>
        </div>
        <div class="dash-actions">
          <div class="dash-search">
            <Icon icon="mdi:magnify" />
            <input v-model="query" placeholder="搜索任务 / 账单" />
          </div>
          <button class="primary" @click="openCreate">新建任务</button>
          <button class="ghost" @click="openPomodoro">开始番茄</button>
        </div>
      </header>

      <section class="dash-kpis">
        <div class="kpi-card">
          <p class="muted">今日支出</p>
          <h2>¥ {{ todayExpense.toFixed(2) }}</h2>
          <span class="kpi-badge">自动分类</span>
        </div>
        <div class="kpi-card">
          <p class="muted">本月支出</p>
          <h2>¥ {{ monthExpense.toFixed(2) }}</h2>
          <span class="kpi-badge">趋势追踪</span>
        </div>
        <div class="kpi-card">
          <p class="muted">待办提醒</p>
          <h2>{{ todayTasks.length ? inProgress : overview.todoCount }} 项</h2>
          <span class="kpi-badge">进行中</span>
        </div>
        <div class="kpi-card">
          <p class="muted">完成度</p>
          <h2>{{ completion }}%</h2>
          <span class="kpi-badge">已完成 {{ completed }} 项</span>
        </div>
      </section>

      <div class="dash-grid">
        <section class="dash-main">
          <div class="panel glass dash-flow">
            <div class="panel-head">
              <div>
                <h3>Revenue Flow</h3>
                <p class="muted">收入与支出波动趋势（示例走势）</p>
              </div>
              <div class="flow-pills">
                <button class="ghost pill">All</button>
                <button class="ghost pill">Withdrawal</button>
                <button class="ghost pill">Savings</button>
                <button class="ghost pill">Deposit</button>
              </div>
            </div>

            <div class="flow-chart">
              <div v-for="bar in flowBars" :key="bar.id" class="flow-bar">
                <span :style="{ height: bar.height + '%' }"></span>
              </div>
            </div>

            <div class="flow-meta">
              <div class="flow-stat">
                <span class="dot income"></span>
                <div>
                  <p class="muted">Income</p>
                  <h4>¥ {{ (monthExpense * 1.12).toFixed(2) }}</h4>
                </div>
              </div>
              <div class="flow-stat">
                <span class="dot expense"></span>
                <div>
                  <p class="muted">Expense</p>
                  <h4>¥ {{ monthExpense.toFixed(2) }}</h4>
                </div>
              </div>
              <div class="flow-stat">
                <span class="dot" style="background:#38bdf8"></span>
                <div>
                  <p class="muted">Focus</p>
                  <h4>{{ focusMinutes }} min</h4>
                </div>
              </div>
              <button class="ghost" @click="goWeeklyReport">查看洞察</button>
            </div>
          </div>

          <div class="panel glass dash-tasks">
            <div class="section-title">
              <div>
                <h3>今日任务</h3>
                <p class="muted">共 {{ todayTasks.length }} 项 · 已完成 {{ completed }} · 进行中 {{ inProgress }}</p>
              </div>
              <button class="primary task-pill" @click="openCreate">新建任务</button>
            </div>

            <div class="task-toolbar">
              <div class="task-filters">
                <div class="search">
                  <Icon icon="mdi:magnify" />
                  <input v-model="query" placeholder="搜索任务" />
                </div>
                <select v-model="statusFilter">
                  <option value="all">全部</option>
                  <option value="todo">待办</option>
                  <option value="done">已完成</option>
                </select>
                <select v-model="priorityFilter">
                  <option value="all">优先级</option>
                  <option v-for="item in priorities" :key="item" :value="item">
                    {{ item }}
                  </option>
                </select>
              </div>
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
                  <button class="ghost task-pill" @click="openEdit(task)">编辑</button>
                  <button class="ghost task-pill danger" @click="removeTask(task.id)">删除</button>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <aside class="dash-side">
          <section class="panel glass dash-card">
            <div class="card-top">
              <div>
                <p class="muted">My Card</p>
                <h3>家庭资金池</h3>
              </div>
              <span class="chip">VISA</span>
            </div>
            <div class="card-balance">
              <p class="muted">Available Balance</p>
              <h2>¥ {{ (monthExpense * 3.2 + 1280).toFixed(2) }}</h2>
            </div>
            <div class="card-meta">
              <div>
                <p class="muted">Card Holder</p>
                <strong>{{ currentName }}</strong>
              </div>
              <div>
                <p class="muted">Valid</p>
                <strong>12/28</strong>
              </div>
            </div>
          </section>

          <section class="panel glass dash-transactions">
            <div class="section-title">
              <h3>Transactions</h3>
              <button class="ghost" @click="$router.push('/ledger')">更多</button>
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
          </section>

          <section class="panel glass dash-habits">
            <div class="section-title">
              <h3>习惯追踪</h3>
              <button class="ghost" @click="goHabits">编辑</button>
            </div>
            <div class="habit-list">
              <div v-for="habit in habits" :key="habit.id" class="habit-item">
                <div class="habit-info">
                  <div class="habit-icon">
                    <Icon :icon="habit.icon" />
                  </div>
                  <div>
                    <div class="habit-title">{{ habit.name }}</div>
                    <div class="muted">连续 {{ habit.streak }} 天</div>
                  </div>
                </div>
                <button class="habit-check" :class="habit.done && 'done'" @click="toggleHabitCheck(habit)">
                  {{ habit.done ? '已完成' : '打卡' }}
                </button>
              </div>
            </div>
          </section>

          <section class="panel glass dash-upcoming">
            <div class="section-title">
              <h3>待办安排</h3>
              <button class="ghost" @click="openCalendar">日历</button>
            </div>
            <div class="upcoming-list">
              <div v-if="!todayItems.length" class="empty-state">暂无安排</div>
              <div v-else>
                <div v-if="mustTodayItems.length" class="upcoming-group">
                  <div class="upcoming-group-title">今日必做</div>
                  <div
                    v-for="item in mustTodayItems"
                    :key="item.id"
                    class="upcoming-item"
                    @click="toggleUpcomingStatus(item)"
                  >
                    <span class="upcoming-stamp" :class="`status-${resolveStatus(item)}`">
                      {{ getUpcomingStatusLabel(resolveStatus(item)) }}
                    </span>
                    <div class="upcoming-title">
                      <Icon :icon="item.icon" />
                      {{ item.title }}
                    </div>
                  </div>
                </div>

                <div v-if="hasUpcomingSplit" class="upcoming-divider"></div>

                <div v-if="coverTodayItems.length" class="upcoming-group">
                  <div class="upcoming-group-title">涵盖今日</div>
                  <div
                    v-for="item in coverTodayItems"
                    :key="item.id"
                    class="upcoming-item"
                    @click="toggleUpcomingStatus(item)"
                  >
                    <span class="upcoming-stamp" :class="`status-${resolveStatus(item)}`">
                      {{ getUpcomingStatusLabel(resolveStatus(item)) }}
                    </span>
                    <div class="upcoming-title">
                      <Icon :icon="item.icon" />
                      {{ item.title }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>

    <!-- Modals retained to avoid dead code + keep UX parity -->
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
.dashboard-v2 {
  color: var(--text);
}

.dash-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 24px 96px;
  display: grid;
  gap: 24px;
}

.dash-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.dash-title h1 {
  font-size: 28px;
  margin-top: 6px;
}

.dash-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dash-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--input-bg);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  min-width: 240px;
  box-shadow: var(--shadow-soft);
}

.dash-search input {
  border: none;
  background: transparent;
  outline: none;
  color: var(--input-text);
  width: 180px;
}

.dash-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.kpi-card {
  padding: 18px;
  border-radius: 18px;
  background: var(--glass);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(16px) saturate(140%);
}

.kpi-card h2 {
  margin-top: 8px;
  font-size: 20px;
}

.kpi-badge {
  display: inline-flex;
  margin-top: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  font-size: 12px;
  color: var(--text-muted);
}

.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 24px;
}

.dash-main {
  display: grid;
  gap: 24px;
}

.panel {
  padding: 20px;
  border-radius: var(--radius-lg);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.flow-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pill {
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
}

.flow-chart {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
  height: 180px;
  margin-top: 18px;
  align-items: end;
}

.flow-bar {
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.flow-bar span {
  display: block;
  width: 100%;
  border-radius: 12px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 60%, transparent), color-mix(in srgb, var(--accent) 45%, transparent));
  box-shadow: 0 10px 20px color-mix(in srgb, var(--accent) 20%, transparent);
}

.flow-meta {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.flow-stat {
  display: flex;
  align-items: center;
  gap: 10px;
}

.flow-stat h4 {
  margin-top: 4px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.dot.income {
  background: #34d399;
}

.dot.expense {
  background: #f97316;
}

.dash-tasks .task-list {
  margin-top: 12px;
  display: grid;
  gap: 12px;
}

.dash-side {
  display: grid;
  gap: 20px;
}

.dash-card {
  background: radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 25%, transparent), transparent 55%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.9));
  color: #f8fafc;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-balance h2 {
  margin-top: 8px;
  font-size: 22px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  gap: 16px;
}

.tx-list {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.tx-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.tx-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}

.tx-icon.income {
  background: color-mix(in srgb, #34d399 25%, transparent);
}

.tx-icon.expense {
  background: color-mix(in srgb, #f97316 25%, transparent);
}

.tx-amount.income {
  color: #34d399;
}

.tx-amount.expense {
  color: #f97316;
}

@media (max-width: 1200px) {
  .dash-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dash-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dash-kpis {
    grid-template-columns: 1fr;
  }
  .dash-actions {
    width: 100%;
  }
  .dash-search {
    width: 100%;
  }
}
</style>
