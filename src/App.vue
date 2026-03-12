<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi'

addCollection(mdi)

type ThemeMode = 'dark' | 'light' | 'warm'

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

const theme = ref<ThemeMode>('light')

const applyTheme = (value: ThemeMode) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value
    document.body.dataset.theme = value
  }
}

const themes = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '暗黑' },
  { id: 'warm', label: '暖色' }
] as const

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

const completed = computed(() => tasks.value.filter((t) => t.done).length)
const completion = computed(() =>
  tasks.value.length ? Math.round((completed.value / tasks.value.length) * 100) : 0
)
const focusMinutes = computed(() => completed.value * 25)

onMounted(() => {
  const saved = localStorage.getItem('pulse.theme') as ThemeMode | null
  if (saved) theme.value = saved
  applyTheme(theme.value)
})

watch(theme, (value) => {
  localStorage.setItem('pulse.theme', value)
  applyTheme(value)
})
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
          董事长
        </div>
      </div>
    </header>

    <main class="dashboard">
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <p class="kicker">今日概览</p>
            <h1>早安，董事长</h1>
            <p class="muted">把任务、习惯、专注节奏放在一处，今天继续稳步推进。</p>
          </div>
          <button class="primary">新建任务</button>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <span>今日任务</span>
            <strong>{{ tasks.length }}</strong>
          </div>
          <div class="stat-card">
            <span>已完成</span>
            <strong>{{ completed }}</strong>
          </div>
          <div class="stat-card">
            <span>完成度</span>
            <strong>{{ completion }}%</strong>
            <div class="progress">
              <div class="bar" :style="{ width: completion + '%' }"></div>
            </div>
          </div>
          <div class="stat-card">
            <span>专注时长</span>
            <strong>{{ focusMinutes }} 分钟</strong>
          </div>
        </div>

        <div class="section-title">
          <h3>今日任务</h3>
          <button class="ghost">查看全部</button>
        </div>

        <ul class="task-list">
          <li v-for="task in tasks" :key="task.id" class="task-item">
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
            <div class="task-status" :class="task.done && 'done'">
              {{ task.done ? '已完成' : '进行中' }}
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
  </div>
</template>
