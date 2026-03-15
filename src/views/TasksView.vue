<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'
import { useRecycleFly } from '../composables/useRecycleFly'

addCollection(mdi)

type Task = {
  id: string | number
  title: string
  category: string
  priority: 'P1' | 'P2' | 'P3'
  startAt?: string
  endAt?: string
  rangeLabel: string
  dueDate: string
  done: boolean
  status?: number
  icon: string
}

const categories = ['家庭', '工作', '健康', '学习']
const priorities: Array<Task['priority']> = ['P1', 'P2', 'P3']

const pad = (value: number) => String(value).padStart(2, '0')
const toLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const toDateTimeLocal = (value?: string) => {
  if (!value) return ''
  const normalized = value.replace('T', ' ').trim()
  return normalized.slice(0, 16).replace(' ', 'T')
}
const toServerDateTime = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.includes('T')) {
    const base = normalized.replace('T', ' ')
    return base.length === 16 ? `${base}:00` : base
  }
  return normalized.length === 16 ? `${normalized}:00` : normalized
}
const buildRangeLabel = (startAt?: string, endAt?: string, dueDate?: string) => {
  const start = startAt ? startAt.replace('T', ' ') : ''
  const end = endAt ? endAt.replace('T', ' ') : ''
  if (start && end) {
    const startDate = start.slice(0, 10)
    const endDate = end.slice(0, 10)
    const startTime = start.slice(11, 16)
    const endTime = end.slice(11, 16)
    if (startDate === endDate) {
      return `${startDate} ${startTime} ~ ${endTime}`
    }
    return `${start.slice(0, 16)} ~ ${end.slice(0, 16)}`
  }
  if (end) return end.slice(0, 16)
  if (start) return start.slice(0, 16)
  return dueDate || ''
}
const buildDefaultRange = () => {
  const now = new Date()
  const end = new Date()
  end.setHours(23, 59, 0, 0)
  const formatLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return {
    startAt: formatLocal(now),
    endAt: formatLocal(end)
  }
}

const tasks = ref<Task[]>([])
const now = shallowRef(new Date())
const todayKey = computed(() => toLocalDateKey(now.value))
let todayTimer: ReturnType<typeof setInterval> | null = null
const loading = shallowRef(false)
const error = shallowRef('')

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done' | 'overdue'>('all')
const priorityFilter = ref<'all' | Task['priority']>('all')
const modalOpen = ref(false)
const editingId = ref<string | number | null>(null)

const { flyToRecycle } = useRecycleFly()
const form = ref<{
  title: string
  category: string
  priority: Task['priority']
  startAt: string
  endAt: string
  icon: string
}>({
  title: '',
  category: categories[0] ?? '家庭',
  priority: priorities[1] ?? 'P2',
  startAt: '',
  endAt: '',
  icon: 'mdi:checkbox-marked-circle-outline'
})

const getTaskRange = (task: Task) => {
  const startDate = (task.startAt || task.dueDate || '').slice(0, 10)
  const endDate = (task.endAt || task.startAt || task.dueDate || '').slice(0, 10)
  return { startDate, endDate }
}

const resolveStatus = (task: Task) => {
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
    return resolveStatus(task) !== 2
  })
)

const overdueTasks = computed(() => tasks.value.filter((t) => resolveStatus(t) === 2))

const filteredTodayTasks = computed(() => {
  if (statusFilter.value === 'overdue') return []
  return todayTasks.value.filter((task) => {
    const hitQuery = task.title.includes(query.value.trim())
    const status = resolveStatus(task)
    const hitStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'done' ? status === 1 : status === 0)
    const hitPriority =
      priorityFilter.value === 'all' || task.priority === priorityFilter.value
    return hitQuery && hitStatus && hitPriority
  })
})

const filteredOverdueTasks = computed(() => {
  if (!(statusFilter.value === 'all' || statusFilter.value === 'overdue')) return []
  return overdueTasks.value.filter((task) => {
    const hitQuery = task.title.includes(query.value.trim())
    const hitPriority =
      priorityFilter.value === 'all' || task.priority === priorityFilter.value
    return hitQuery && hitPriority
  })
})

const completed = computed(() => todayTasks.value.filter((t) => resolveStatus(t) === 1).length)
const inProgress = computed(() => todayTasks.value.filter((t) => resolveStatus(t) === 0).length)
const completion = computed(() =>
  todayTasks.value.length
    ? Math.round((completed.value / todayTasks.value.length) * 100)
    : 0
)
const overdue = computed(() => overdueTasks.value.length)

const getStatusLabel = (task: Task) => {
  const status = resolveStatus(task)
  if (status === 1) return '已完成'
  if (status === 2) return '逾期'
  return '进行中'
}

const getStatusClass = (task: Task) => {
  const status = resolveStatus(task)
  if (status === 1) return 'done'
  if (status === 2) return 'overdue'
  return ''
}

const openCreate = () => {
  editingId.value = null
  const { startAt, endAt } = buildDefaultRange()
  form.value = {
    title: '',
    category: categories[0] ?? '家庭',
    priority: priorities[1] ?? 'P2',
    startAt,
    endAt,
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
    startAt: toDateTimeLocal(task.startAt),
    endAt: toDateTimeLocal(task.endAt),
    icon: task.icon
  }
  modalOpen.value = true
}

const fetchTasks = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await apiFetch<any[]>('/tasks')
    tasks.value = data.map((item) => {
      const startAt = item.start_at || item.startAt
      const endAt = item.end_at || item.endAt
      const dueDate = item.due_date ?? item.due ?? ''
      return {
        id: item.id,
        title: item.title,
        category: item.category,
        priority: item.priority,
        startAt,
        endAt,
        dueDate,
        rangeLabel: buildRangeLabel(startAt, endAt, dueDate),
        done: !!item.done,
        status: typeof item.status === 'number' ? item.status : undefined,
        icon: item.icon || 'mdi:checkbox-marked-circle-outline'
      }
    })
  } catch (err: any) {
    error.value = err?.message || '任务加载失败'
  } finally {
    loading.value = false
  }
}

const toggleDone = async (task: Task) => {
  task.done = !task.done
  try {
    await apiFetch(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: { done: task.done }
    })
    await fetchTasks()
  } catch {
    pushToast('任务状态更新失败', 'error')
  }
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
          start_at: toServerDateTime(form.value.startAt),
          end_at: toServerDateTime(form.value.endAt),
          icon: form.value.icon
        }
      })
      pushToast('任务已更新', 'success')
    } else {
      await apiFetch('/tasks', {
        method: 'POST',
        body: {
          title: form.value.title,
          category: form.value.category,
          priority: form.value.priority,
          start_at: toServerDateTime(form.value.startAt),
          end_at: toServerDateTime(form.value.endAt),
          icon: form.value.icon
        }
      })
      pushToast('任务已创建', 'success')
    }
    await fetchTasks()
  } catch {
    pushToast('任务保存失败', 'error')
  }
  modalOpen.value = false
}

const removeTask = async (id: string | number, evt?: MouseEvent) => {
  if (typeof window !== 'undefined') {
    const ok = window.confirm('确认删除该任务吗？')
    if (!ok) return
  }
  const sourceEl = (evt?.currentTarget as HTMLElement | null)?.closest('.task-item') as HTMLElement | null
  flyToRecycle(sourceEl)
  try {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' })
    await fetchTasks()
    pushToast('任务已删除（已进入回收站）', 'success')
  } catch {
    pushToast('任务删除失败', 'error')
  }
}

onMounted(() => {
  todayTimer = window.setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)
  fetchTasks()
})

onUnmounted(() => {
  if (todayTimer) {
    clearInterval(todayTimer)
    todayTimer = null
  }
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="task-board-head">
          <div>
            <h2>任务管理</h2>
            <p class="muted">今日 {{ todayTasks.length }} 项 · 已完成 {{ completed }} · 进行中 {{ inProgress }}</p>
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
              <option value="overdue">逾期</option>
            </select>
            <select v-model="priorityFilter">
              <option value="all">优先级</option>
              <option v-for="item in priorities" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </div>

        </div>

        <div class="stat-grid compact">
          <div class="stat-card"><span>今日总数</span><strong>{{ todayTasks.length }}</strong></div>
          <div class="stat-card"><span>已完成</span><strong>{{ completed }}</strong></div>
          <div class="stat-card"><span>完成度</span><strong>{{ completion }}%</strong></div>
          <div class="stat-card"><span>逾期</span><strong>{{ overdue }}</strong></div>
        </div>

        <div v-if="loading" class="empty-state">加载中…</div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>
        <div v-else-if="!filteredTodayTasks.length && !filteredOverdueTasks.length" class="empty-state">
          暂无任务，点击右上角新建
        </div>

        <div v-else class="task-section">
          <div v-if="filteredTodayTasks.length" class="task-section-block">
            <div class="task-section-title">今日任务</div>
            <ul class="task-list">
              <li v-for="task in filteredTodayTasks" :key="task.id" class="task-item">
                <div class="task-icon" @click="toggleDone(task)">
                  <Icon :icon="task.icon" />
                </div>
                <div class="task-body">
                  <div class="task-title" :class="task.done && 'done'">{{ task.title }}</div>
                  <div class="task-meta">
                    <span class="tag">{{ task.category }}</span>
                    <span class="tag" :class="`priority-${task.priority}`">{{ task.priority }}</span>
                    <span class="tag">{{ task.rangeLabel }}</span>
                  </div>
                </div>
                <div class="task-actions">
                  <span class="task-status task-pill" :class="getStatusClass(task)">
                    {{ getStatusLabel(task) }}
                  </span>
                  <button class="ghost task-pill" @click="openEdit(task)">编辑</button>
                  <button class="ghost task-pill danger" @click="removeTask(task.id, $event)">删除</button>
                </div>
              </li>
            </ul>
          </div>

          <div v-if="filteredOverdueTasks.length" class="task-section-divider"></div>

          <div v-if="filteredOverdueTasks.length" class="task-section-block overdue">
            <div class="task-section-title overdue">逾期任务</div>
            <ul class="task-list">
              <li v-for="task in filteredOverdueTasks" :key="task.id" class="task-item overdue">
                <div class="task-icon" @click="toggleDone(task)">
                  <Icon :icon="task.icon" />
                </div>
                <div class="task-body">
                  <div class="task-title">{{ task.title }}</div>
                  <div class="task-meta">
                    <span class="tag">{{ task.category }}</span>
                    <span class="tag" :class="`priority-${task.priority}`">{{ task.priority }}</span>
                    <span class="tag">{{ task.rangeLabel }}</span>
                  </div>
                </div>
                <div class="task-actions">
                  <span class="task-status task-pill overdue">逾期</span>
                  <button class="ghost task-pill" @click="openEdit(task)">编辑</button>
                  <button class="ghost task-pill danger" @click="removeTask(task.id, $event)">删除</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
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
              <span>开始</span>
              <input v-model="form.startAt" type="datetime-local" />
            </label>
            <label>
              <span>结束</span>
              <input v-model="form.endAt" type="datetime-local" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="modalOpen = false">取消</button>
            <button class="primary" @click="saveTask">保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
