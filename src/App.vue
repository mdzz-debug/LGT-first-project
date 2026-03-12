<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Category = '工作' | '家庭' | '健康' | '学习'
type Priority = 'P1' | 'P2' | 'P3'

type Task = {
  id: string
  title: string
  category: Category
  priority: Priority
  due: string
  done: boolean
}

type Habit = {
  id: string
  name: string
  streak: number
  done: boolean
}

const STORAGE_KEY = 'pulse.tasks'

const today = new Date().toISOString().slice(0, 10)

const seedTasks: Task[] = [
  {
    id: 't-1',
    title: '给团队同步本周目标与节奏',
    category: '工作',
    priority: 'P1',
    due: today,
    done: false
  },
  {
    id: 't-2',
    title: '给家里采购清单补货',
    category: '家庭',
    priority: 'P2',
    due: today,
    done: true
  },
  {
    id: 't-3',
    title: '30 分钟力量训练',
    category: '健康',
    priority: 'P2',
    due: today,
    done: false
  }
]

const loadTasks = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedTasks
  try {
    const parsed = JSON.parse(raw) as Task[]
    return parsed.length ? parsed : seedTasks
  } catch {
    return seedTasks
  }
}

const tasks = ref<Task[]>(loadTasks())
const filter = ref<'all' | 'todo' | 'done'>('all')

const newTask = ref({
  title: '',
  category: '工作' as Category,
  priority: 'P2' as Priority,
  due: today
})

const habits = ref<Habit[]>([
  { id: 'h-1', name: '晨间拉伸', streak: 6, done: true },
  { id: 'h-2', name: '英语 10 分钟', streak: 12, done: false },
  { id: 'h-3', name: '阅读 20 页', streak: 3, done: false }
])

const total = computed(() => tasks.value.length)
const done = computed(() => tasks.value.filter((t) => t.done).length)
const pending = computed(() => total.value - done.value)
const completion = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

const filteredTasks = computed(() => {
  if (filter.value === 'todo') return tasks.value.filter((t) => !t.done)
  if (filter.value === 'done') return tasks.value.filter((t) => t.done)
  return tasks.value
})

const focusMinutes = computed(() => done.value * 25)
const insight = computed(() => {
  if (completion.value >= 80) return '今天节奏很稳，继续保持冲刺！'
  if (completion.value >= 50) return '完成度不错，优先拿下 P1 任务。'
  return '先做一件最小但最重要的事，建立动能。'
})

const addTask = () => {
  if (!newTask.value.title.trim()) return
  tasks.value.unshift({
    id: `t-${Date.now()}`,
    title: newTask.value.title.trim(),
    category: newTask.value.category,
    priority: newTask.value.priority,
    due: newTask.value.due || today,
    done: false
  })
  newTask.value.title = ''
}

const toggleTask = (task: Task) => {
  task.done = !task.done
}

const removeTask = (id: string) => {
  tasks.value = tasks.value.filter((t) => t.id !== id)
}

const toggleHabit = (habit: Habit) => {
  habit.done = !habit.done
  habit.streak = habit.done ? habit.streak + 1 : Math.max(habit.streak - 1, 0)
}

watch(
  tasks,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true }
)
</script>

<template>
  <div class="app">
    <header class="hero glass">
      <div>
        <span class="badge">Vue 3 + TypeScript</span>
        <h1>PulseList · 轻量生活协作面板</h1>
        <p class="subtitle">
          把任务、习惯、专注节奏聚合在一个界面。更适合家庭/小团队的「轻量现代感」项目范式。
        </p>
      </div>
      <div class="hero-actions">
        <button class="primary">开启专注</button>
        <button class="ghost">分享给家人</button>
      </div>
    </header>

    <section class="grid">
      <div class="panel glass">
        <div class="panel-head">
          <h2>今日任务</h2>
          <div class="filters">
            <button :class="['chip', filter === 'all' && 'active']" @click="filter = 'all'">全部</button>
            <button :class="['chip', filter === 'todo' && 'active']" @click="filter = 'todo'">待办</button>
            <button :class="['chip', filter === 'done' && 'active']" @click="filter = 'done'">完成</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span>总任务</span>
            <strong>{{ total }}</strong>
          </div>
          <div class="stat">
            <span>已完成</span>
            <strong>{{ done }}</strong>
          </div>
          <div class="stat">
            <span>待处理</span>
            <strong>{{ pending }}</strong>
          </div>
          <div class="stat wide">
            <span>完成度</span>
            <strong>{{ completion }}%</strong>
            <div class="progress">
              <div class="bar" :style="{ width: completion + '%' }"></div>
            </div>
          </div>
        </div>

        <form class="task-form" @submit.prevent="addTask">
          <input v-model="newTask.title" placeholder="输入一个关键任务…" />
          <select v-model="newTask.category">
            <option>工作</option>
            <option>家庭</option>
            <option>健康</option>
            <option>学习</option>
          </select>
          <select v-model="newTask.priority">
            <option>P1</option>
            <option>P2</option>
            <option>P3</option>
          </select>
          <input v-model="newTask.due" type="date" />
          <button class="primary" type="submit">添加</button>
        </form>

        <ul class="task-list">
          <li v-for="task in filteredTasks" :key="task.id" class="task">
            <button class="check" @click="toggleTask(task)">
              <span :class="['dot', task.done && 'done']"></span>
            </button>
            <div class="task-info">
              <div class="title" :class="{ done: task.done }">{{ task.title }}</div>
              <div class="meta">
                <span class="tag">{{ task.category }}</span>
                <span class="tag">{{ task.priority }}</span>
                <span class="tag">{{ task.due }}</span>
              </div>
            </div>
            <button class="ghost" @click="removeTask(task.id)">移除</button>
          </li>
        </ul>
      </div>

      <aside class="panel glass">
        <h3>习惯与专注</h3>

        <div class="habit-list">
          <div v-for="habit in habits" :key="habit.id" class="habit">
            <div>
              <div class="title">{{ habit.name }}</div>
              <div class="meta">连续 {{ habit.streak }} 天</div>
            </div>
            <button class="chip" :class="habit.done && 'active'" @click="toggleHabit(habit)">
              {{ habit.done ? '已完成' : '打卡' }}
            </button>
          </div>
        </div>

        <div class="focus-card">
          <div>
            <h4>今日专注</h4>
            <p>已完成 {{ focusMinutes }} 分钟 · 建议再 1 轮 25 分钟</p>
          </div>
          <button class="primary">开始番茄</button>
        </div>

        <div class="insight">
          <h4>AI 观察</h4>
          <p>{{ insight }}</p>
        </div>
      </aside>
    </section>

    <footer class="footer">
      方案关键词：轻量协作、习惯打卡、专注计时、家庭共享、数据本地化。
    </footer>
  </div>
</template>
