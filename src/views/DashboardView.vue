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
  const hour = new Date().getHours()
  if (hour < 11) return '早安'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 23) return '晚上好'
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
  dueDate?: string
  startAt?: string
  endAt?: string
  doneAt?: string
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

const defaultCategories = ['家庭', '工作', '健康', '学习']
const categories = ref<string[]>([...defaultCategories])
const priorities: Array<Task['priority']> = ['P1', 'P2', 'P3']

const categoryIconMap: Record<string, string> = {
  家庭: 'mdi:home-heart',
  工作: 'mdi:briefcase-outline',
  健康: 'mdi:heart-pulse',
  学习: 'mdi:book-open-page-variant',
  生活: 'mdi:sofa-outline',
  娱乐: 'mdi:gamepad-variant-outline',
  任务管理: 'mdi:clipboard-check-outline'
}

const resolveCategoryIcon = (category: string) =>
  categoryIconMap[category] || 'mdi:checkbox-marked-circle-outline'

const normalizeTaskIcon = (raw: string | undefined | null, category: string) => {
  const icon = (raw || '').trim()
  if (!icon) return resolveCategoryIcon(category)
  if (icon.includes(':')) return icon
  if (icon === 'heart') return 'mdi:heart-pulse'
  return resolveCategoryIcon(category)
}

const mergeCategories = (next: string[]) => {
  const merged = new Set([...defaultCategories, ...next.filter(Boolean)])
  categories.value = Array.from(merged)
}

const syncCategoriesFromTasks = () => {
  const merged = new Set(categories.value)
  tasks.value.forEach((task) => {
    if (task.category) merged.add(task.category)
  })
  categories.value = Array.from(merged)
}

const tasks = ref<Task[]>([])

const habits = ref<Habit[]>([])

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
  category: categories.value[0] ?? '家庭',
  priority: priorities[1] ?? 'P2',
  due: '',
  icon: resolveCategoryIcon(categories.value[0] ?? '家庭')
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

const toLocalDateKey = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const todayTaskKey = computed(() => toLocalDateKey(new Date()))

const getTaskEndDate = (task: Task) =>
  (task.endAt || task.dueDate || task.due || '').slice(0, 10)

const getTaskDoneDate = (task: Task) => (task.doneAt || '').slice(0, 10)

const todayTasks = computed(() =>
  tasks.value.filter((task) => {
    const endDate = getTaskEndDate(task)
    const doneDate = task.done ? getTaskDoneDate(task) : ''
    return (endDate && endDate === todayTaskKey.value) || (doneDate && doneDate === todayTaskKey.value)
  })
)

const todayCompleted = computed(() => todayTasks.value.filter((t) => t.done).length)
const todayCompletion = computed(() =>
  todayTasks.value.length ? Math.round((todayCompleted.value / todayTasks.value.length) * 100) : 0
)

const overview = ref({
  completionRate: 0,
  focusMinutes: 0,
  todoCount: 0,
  teamMembers: 0
})

const completed = computed(() => tasks.value.filter((t) => t.done).length)
const focusMinutes = computed(() =>
  tasks.value.length ? completed.value * 25 : overview.value.focusMinutes
)



const openCreate = () => {
  editingId.value = null
  form.value = {
    title: '',
    category: categories.value[0] ?? '家庭',
    priority: priorities[1] ?? 'P2',
    due: '',
    icon: resolveCategoryIcon(categories.value[0] ?? '家庭')
  }
  modalOpen.value = true
}


const loadTaskCategories = async () => {
  try {
    const data = await apiFetch<string[]>('/tasks/categories')
    mergeCategories(data)
  } catch {
    // ignore
  }
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
      dueDate: item.due_date ?? item.due,
      startAt: item.start_at || item.startAt,
      endAt: item.end_at || item.endAt,
      doneAt: item.done_at || item.doneAt,
      done: !!item.done,
      icon: normalizeTaskIcon(item.icon, item.category)
    }))
    syncCategoriesFromTasks()
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

const saveTask = async () => {
  if (!form.value.title.trim()) return
  try {
    if (editingId.value) {
      const icon = normalizeTaskIcon(form.value.icon, form.value.category)
      await apiFetch(`/tasks/${editingId.value}`, {
        method: 'PATCH',
        body: {
          title: form.value.title,
          category: form.value.category,
          priority: form.value.priority,
          due: form.value.due,
          icon
        }
      })
    } else {
      const icon = normalizeTaskIcon(form.value.icon, form.value.category)
      await apiFetch('/tasks', {
        method: 'POST',
        body: {
          title: form.value.title,
          category: form.value.category,
          priority: form.value.priority,
          due: form.value.due,
          icon
        }
      })
    }
    await fetchTasks()
    if (form.value.category) mergeCategories([form.value.category])
  } catch {
    // ignore
  }
  modalOpen.value = false
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
    status: item.status,
    sourceType: item.sourceType,
    startAt: item.startAt,
    endAt: item.endAt
  }))
)

const todayKey = toLocalDateKey(new Date())
const getItemRange = (item: UpcomingItem) => {
  const startDate = (item.startAt || item.date).slice(0, 10)
  const endDate = (item.endAt || item.startAt || item.date).slice(0, 10)
  return { startDate, endDate }
}

const todayItems = computed(() =>
  upcoming.value.filter((item) => {
    const { startDate, endDate } = getItemRange(item)
    return startDate <= todayKey && endDate >= todayKey
  })
)

const mustTodayItems = computed(() =>
  todayItems.value.filter((item) => {
    const { startDate, endDate } = getItemRange(item)
    return startDate === todayKey && endDate === todayKey
  })
)

const coverTodayItems = computed(() =>
  todayItems.value.filter((item) => {
    const { startDate, endDate } = getItemRange(item)
    return !(startDate === todayKey && endDate === todayKey)
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

  await Promise.all([loadCurrentUser(), fetchOverview(), loadTaskCategories(), fetchTasks(), fetchHabits(), fetchUpcoming()])
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="dashboard">
      <div class="main-column">
        <section class="panel glass overview">
          <div class="overview-header">
            <div>
              <p class="kicker">今日概览</p>
              <h1>{{ greetingText }}，{{ currentName }}</h1>
              <p class="muted">聚焦关键任务，清晰掌控节奏与优先级。</p>
            </div>
            <div class="overview-actions">
              <button class="primary" @click="openCreate">新建任务</button>
              <button class="ghost" @click="goWeeklyReport">查看周报</button>
            </div>
          </div>

          <div class="overview-grid">
            <div class="overview-card">
              <div>
                <p class="muted">今日完成度</p>
                <h2>{{ todayCompletion }}%</h2>
              </div>
              <div class="progress ring">
                <div class="bar" :style="{ width: todayCompletion + '%' }"></div>
              </div>
              <span class="overview-watermark">
                <Icon icon="mdi:check-circle-outline" />
              </span>
            </div>
            <div class="overview-card">
              <div>
                <p class="muted">专注时长</p>
                <h2>{{ focusMinutes }} min</h2>
              </div>
              <span class="overview-watermark">
                <Icon icon="mdi:timer-sand" />
              </span>
            </div>
            <div class="overview-card">
              <div>
                <p class="muted">待办提醒</p>
                <h2>{{ tasks.length ? tasks.length - completed : overview.todoCount }} 项</h2>
              </div>
              <span class="overview-watermark">
                <Icon icon="mdi:clipboard-check-outline" />
              </span>
            </div>
            <div class="overview-card">
              <div>
                <p class="muted">团队/家庭</p>
                <h2>{{ overview.teamMembers || 0 }} 人</h2>
              </div>
              <span class="overview-watermark">
                <Icon icon="mdi:account-group-outline" />
              </span>
            </div>
          </div>
        </section>
      </div>

      <aside class="side">
        <section class="panel glass">
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

        <section class="panel glass">
          <div class="section-title">
            <h3>待办安排</h3>
            <div class="section-actions">
              <button class="ghost" @click="openCalendar">日历</button>
              <button class="primary task-pill" @click="openCreate">新建任务</button>
            </div>
          </div>
          <div class="upcoming-list">
            <div v-if="!todayItems.length" class="empty-state">暂无安排</div>

            <template v-else>
              <div v-if="mustTodayItems.length" class="upcoming-group">
                <div class="upcoming-group-title">今日必做</div>
                <div
                  v-for="item in mustTodayItems"
                  :key="item.id"
                  class="upcoming-item"
                  @click="toggleUpcomingStatus(item)"
                >
                  <span class="upcoming-stamp" :class="`status-${item.status}`">
                    {{ getUpcomingStatusLabel(item.status) }}
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
                  <span class="upcoming-stamp" :class="`status-${item.status}`">
                    {{ getUpcomingStatusLabel(item.status) }}
                  </span>
                  <div class="upcoming-title">
                    <Icon :icon="item.icon" />
                    {{ item.title }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </section>

        <section class="panel glass focus">
          <div>
            <div class="focus-title">
              <Icon icon="mdi:timer-sand" />
              今日专注
            </div>
            <p class="muted">建议再完成 1 轮 25 分钟。</p>
          </div>
          <button class="primary" @click="openPomodoro">开始番茄</button>
        </section>

        
      </aside>
    </main>

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
              <input v-model="form.category" list="task-categories" placeholder="选择或输入分类" />
              <datalist id="task-categories">
                <option v-for="item in categories" :key="item" :value="item" />
              </datalist>
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
