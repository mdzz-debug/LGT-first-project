<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import { useTheme } from '../composables/useTheme'

addCollection(mdi)

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

const router = useRouter()
const { theme } = useTheme()

const themes = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '暗黑' },
  { id: 'warm', label: '暖色' }
] as const

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

const upcoming = [
  { time: '15:00', title: '家庭采购清单检查', icon: 'mdi:cart-outline' },
  { time: '19:30', title: '团队复盘会议', icon: 'mdi:account-group-outline' },
  { time: '22:00', title: '睡前冥想 10 分钟', icon: 'mdi:meditation' }
]

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done'>('all')
const priorityFilter = ref<'all' | Task['priority']>('all')
const selected = ref<string[]>([])

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  title: '',
  category: categories[0],
  priority: priorities[1],
  due: '',
  icon: 'mdi:checkbox-marked-circle-outline'
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
const selectedCount = computed(() => selected.value.length)
const allSelected = computed(
  () => filteredTasks.value.length > 0 && selected.value.length === filteredTasks.value.length
)

const toggleSelect = (id: string) => {
  if (selected.value.includes(id)) {
    selected.value = selected.value.filter((item) => item !== id)
  } else {
    selected.value = [...selected.value, id]
  }
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selected.value = []
  } else {
    selected.value = filteredTasks.value.map((task) => task.id)
  }
}

const toggleDone = (task: Task) => {
  task.done = !task.done
}

const bulkComplete = () => {
  const ids = new Set(selected.value)
  tasks.value = tasks.value.map((task) =>
    ids.has(task.id) ? { ...task, done: true } : task
  )
  selected.value = []
}

const bulkDelete = () => {
  const ids = new Set(selected.value)
  tasks.value = tasks.value.filter((task) => !ids.has(task.id))
  selected.value = []
}

const openCreate = () => {
  editingId.value = null
  form.value = {
    title: '',
    category: categories[0],
    priority: priorities[1],
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
  selected.value = selected.value.filter((item) => item !== id)
}

const logout = () => {
  localStorage.removeItem('pulse.token')
  router.push('/login')
}
</script>

<template>
  <div class="page" :data-theme="theme">
    <header class="topbar">
      <div class="brand">
        <span class="logo">P</span>
        <span>PulseList</span>
      </div>
      <div class="top-actions">
        <div class="theme-toggle">
          <button
            v-for="item in themes"
            :key="item.id"
            class="chip"
            :class="theme === item.id && 'active'"
            @click="theme = item.id"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="user-pill">
          <Icon icon="mdi:account" />
          罗董
        </div>
        <button class="ghost" @click="logout">退出</button>
      </div>
    </header>

    <main class="dashboard">
      <section class="panel glass overview">
        <div class="overview-header">
          <div>
            <p class="kicker">今日概览</p>
            <h1>早安，罗董</h1>
            <p class="muted">聚焦关键任务，清晰掌控节奏与优先级。</p>
          </div>
          <div class="overview-actions">
            <button class="primary" @click="openCreate">新建任务</button>
            <button class="ghost">查看周报</button>
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
          </div>
          <div class="overview-card">
            <p class="muted">专注时长</p>
            <h2>{{ focusMinutes }} 分钟</h2>
            <span class="tag">番茄节奏</span>
          </div>
          <div class="overview-card">
            <p class="muted">待办提醒</p>
            <h2>{{ tasks.length - completed }} 项</h2>
            <span class="tag">优先处理 P1</span>
          </div>
          <div class="overview-card">
            <p class="muted">团队/家庭</p>
            <h2>4 人</h2>
            <span class="tag">协作中</span>
          </div>
        </div>
      </section>

      <section class="panel glass task-board">
        <div class="section-title">
          <h3>今日任务</h3>
          <div class="task-tools">
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
            <button class="ghost" @click="toggleSelectAll">
              {{ allSelected ? '取消全选' : '全选' }}
            </button>
            <button class="ghost" :disabled="!selectedCount" @click="bulkComplete">批量完成</button>
            <button class="ghost danger" :disabled="!selectedCount" @click="bulkDelete">删除</button>
          </div>
        </div>

        <ul class="task-list">
          <li v-for="task in filteredTasks" :key="task.id" class="task-item">
            <label class="task-check">
              <input type="checkbox" :checked="selected.includes(task.id)" @change="toggleSelect(task.id)" />
              <span></span>
            </label>
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
              <span class="task-status" :class="task.done && 'done'">
                {{ task.done ? '已完成' : '进行中' }}
              </span>
              <button class="ghost small" @click="openEdit(task)">编辑</button>
              <button class="ghost danger" @click="removeTask(task.id)">删除</button>
            </div>
          </li>
        </ul>
      </section>

      <aside class="side">
        <section class="panel glass">
          <div class="section-title">
            <h3>习惯追踪</h3>
            <button class="ghost">编辑</button>
          </div>
          <div class="habit-list">
            <div v-for="habit in habits" :key="habit.id" class="habit-item">
              <div class="habit-icon">
                <Icon :icon="habit.icon" />
              </div>
              <div>
                <div class="habit-title">{{ habit.name }}</div>
                <div class="muted">连续 {{ habit.streak }} 天</div>
              </div>
              <span class="chip" :class="habit.done && 'active'">
                {{ habit.done ? '已完成' : '打卡' }}
              </span>
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
          <button class="primary">开始番茄</button>
        </section>

        <section class="panel glass">
          <div class="section-title">
            <h3>待办安排</h3>
            <button class="ghost">日历</button>
          </div>
          <div class="upcoming-list">
            <div v-for="item in upcoming" :key="item.title" class="upcoming-item">
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
  </div>
</template>
