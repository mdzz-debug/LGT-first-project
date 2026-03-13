<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'
import CalendarModal, { type CalendarEvent } from '../components/CalendarModal.vue'

addCollection(mdi)

const router = useRouter()

type Task = {
  id: string
  title: string
  category: string
  priority: 'P1' | 'P2' | 'P3'
  due: string
  done: boolean
  icon: string
}

type Habit = {
  id: string
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

const categories = ['家庭', '工作', '健康', '学习']
const priorities: Array<Task['priority']> = ['P1', 'P2', 'P3']

const tasks = ref<Task[]>([
  {
    id: 't1',
    title: '梳理下周家庭计划与预算',
    category: '家庭',
    priority: 'P1',
    due: '今天 18:00',
    done: false,
    icon: 'mdi:home-heart'
  },
  {
    id: 't2',
    title: '完成客户需求梳理 & 会议纪要',
    category: '工作',
    priority: 'P1',
    due: '今天 20:00',
    done: true,
    icon: 'mdi:briefcase-outline'
  },
  {
    id: 't3',
    title: '30 分钟力量训练',
    category: '健康',
    priority: 'P2',
    due: '今晚',
    done: false,
    icon: 'mdi:dumbbell'
  },
  {
    id: 't4',
    title: '读完《高效能人士》第四章',
    category: '学习',
    priority: 'P3',
    due: '明天',
    done: false,
    icon: 'mdi:book-open-page-variant'
  }
])

const habits = ref<Habit[]>([
  { id: 'h1', name: '晨间拉伸', streak: 8, icon: 'mdi:weather-sunny', done: true },
  { id: 'h2', name: '英语 15 分钟', streak: 12, icon: 'mdi:translate', done: false },
  { id: 'h3', name: '阅读 20 页', streak: 5, icon: 'mdi:book-open-variant', done: false }
])

const toggleHabitCheck = (habit: Habit) => {
  habit.done = !habit.done
  habit.streak = habit.done ? habit.streak + 1 : Math.max(habit.streak - 1, 0)
}

type UpcomingStatus = 'todo' | 'done' | 'overdue'

type UpcomingItem = {
  time: string
  title: string
  icon: string
  date: string
  status: UpcomingStatus
}

const upcoming = ref<UpcomingItem[]>([
  { time: '09:00', title: '家庭采购清单检查', icon: 'mdi:cart-outline', date: '2026-03-13', status: 'todo' },
  { time: '14:00', title: '英语跟读 20 分钟', icon: 'mdi:translate', date: '2026-03-13', status: 'done' },
  { time: '19:30', title: '团队复盘会议', icon: 'mdi:account-group-outline', date: '2026-03-13', status: 'overdue' },
  { time: '21:00', title: '阅读 30 分钟', icon: 'mdi:book-open-variant', date: '2026-03-14', status: 'todo' }
])

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done'>('all')
const priorityFilter = ref<'all' | Task['priority']>('all')
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
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

const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    const hitQuery = task.title.includes(query.value.trim())
    const hitStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'done' ? task.done : !task.done)
    const hitPriority =
      priorityFilter.value === 'all' || task.priority === priorityFilter.value
    return hitQuery && hitStatus && hitPriority
  })
})

const completed = computed(() => tasks.value.filter((t) => t.done).length)
const completion = computed(() =>
  tasks.value.length ? Math.round((completed.value / tasks.value.length) * 100) : 0
)
const focusMinutes = computed(() => completed.value * 25)

const toggleDone = (task: Task) => {
  task.done = !task.done
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

const saveTask = () => {
  if (!form.value.title.trim()) return
  if (editingId.value) {
    tasks.value = tasks.value.map((task) =>
      task.id === editingId.value
        ? { ...task, ...form.value }
        : task
    )
  } else {
    tasks.value.unshift({
      id: `t${Date.now()}`,
      title: form.value.title,
      category: form.value.category,
      priority: form.value.priority,
      due: form.value.due || '今天',
      done: false,
      icon: form.value.icon
    })
  }
  modalOpen.value = false
}

const removeTask = (id: string) => {
  tasks.value = tasks.value.filter((task) => task.id !== id)
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

const toggleUpcomingStatus = (item: UpcomingItem) => {
  item.status = item.status === 'done' ? 'todo' : 'done'
}

const calendarEvents = computed<CalendarEvent[]>(() =>
  upcoming.value.map((item) => ({
    date: item.date,
    title: item.title,
    time: item.time,
    status: item.status
  }))
)

onMounted(() => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('pomodoro') === '1') {
    openPomodoro()
  }
  if (params.get('calendar') === '1') {
    calendarOpen.value = true
  }
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
              <h1>早安，罗董</h1>
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
                <h2>{{ completion }}%</h2>
              </div>
              <div class="progress ring">
                <div class="bar" :style="{ width: completion + '%' }"></div>
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
                <h2>{{ tasks.length - completed }} 项</h2>
              </div>
              <span class="overview-watermark">
                <Icon icon="mdi:clipboard-check-outline" />
              </span>
            </div>
            <div class="overview-card">
              <div>
                <p class="muted">团队/家庭</p>
                <h2>4 人</h2>
              </div>
              <span class="overview-watermark">
                <Icon icon="mdi:account-group-outline" />
              </span>
            </div>
          </div>
        </section>

        <section class="panel glass task-board">
          <div class="task-board-head">
            <div>
              <h3>今日任务</h3>
              <p class="muted">共 {{ tasks.length }} 项 · 已完成 {{ completed }} · 进行中 {{ tasks.length - completed }}</p>
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

        <section class="panel glass">
          <div class="section-title">
            <h3>待办安排</h3>
            <button class="ghost" @click="openCalendar">日历</button>
          </div>
          <div class="upcoming-list">
            <div v-for="item in upcoming" :key="item.title" class="upcoming-item" @click="toggleUpcomingStatus(item)">
              <span class="upcoming-stamp" :class="`status-${item.status}`">
                {{ getUpcomingStatusLabel(item.status) }}
              </span>
              <div class="upcoming-time">{{ item.time }}</div>
              <div class="upcoming-title">
                <Icon :icon="item.icon" />
                {{ item.title }}
              </div>
            </div>
          </div>
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
