<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
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
  icon: string
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

const getTaskIcon = (task: Task) => normalizeTaskIcon(task.icon, task.category)

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

const pad = (value: number) => String(value).padStart(2, '0')
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

const toLocalDateKey = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const selectedDate = shallowRef(toLocalDateKey(new Date()))

const getTaskRange = (task: Task) => {
  const startDate = (task.startAt || task.dueDate || '').slice(0, 10)
  const endDate = (task.endAt || task.dueDate || startDate).slice(0, 10)
  return { startDate, endDate }
}

const tasks = ref<Task[]>([])

const dailyTasks = computed(() =>
  tasks.value.filter((task) => {
    const { startDate, endDate } = getTaskRange(task)
    if (!startDate || !endDate) return false
    return startDate <= selectedDate.value && endDate >= selectedDate.value
  })
)

const dailyCompleted = computed(() => dailyTasks.value.filter((t) => t.done).length)
const dailyInProgress = computed(() => dailyTasks.value.filter((t) => !t.done).length)
const loading = shallowRef(false)
const error = shallowRef('')

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done'>('all')
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
  category: categories.value[0] ?? '家庭',
  priority: priorities[1] ?? 'P2',
  startAt: '',
  endAt: '',
  icon: resolveCategoryIcon(categories.value[0] ?? '家庭')
})

const loadTaskCategories = async () => {
  try {
    const data = await apiFetch<string[]>('/tasks/categories')
    mergeCategories(data)
  } catch {
    // ignore
  }
}

const filteredTasks = computed(() => {
  return dailyTasks.value.filter((task) => {
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
const overdue = computed(() => {
  const today = toLocalDateKey(new Date())
  return tasks.value.filter((t) => {
    if (t.done) return false
    const date = t.endAt ? t.endAt.slice(0, 10) : t.dueDate
    return !!date && date < today
  }).length
})

const openCreate = () => {
  editingId.value = null
  const { startAt, endAt } = buildDefaultRange()
  form.value = {
    title: '',
    category: categories.value[0] ?? '家庭',
    priority: priorities[1] ?? 'P2',
    startAt,
    endAt,
    icon: resolveCategoryIcon(categories.value[0] ?? '家庭')
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
    icon: getTaskIcon(task)
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
        icon: normalizeTaskIcon(item.icon, item.category)
      }
    })
    syncCategoriesFromTasks()
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
    await Promise.all([loadTaskCategories(), fetchTasks()])
    if (form.value.category) mergeCategories([form.value.category])
  } catch {
    pushToast('任务状态更新失败', 'error')
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
          start_at: toServerDateTime(form.value.startAt),
          end_at: toServerDateTime(form.value.endAt),
          icon
        }
      })
      pushToast('任务已更新', 'success')
    } else {
      const icon = normalizeTaskIcon(form.value.icon, form.value.category)
      await apiFetch('/tasks', {
        method: 'POST',
        body: {
          title: form.value.title,
          category: form.value.category,
          priority: form.value.priority,
          start_at: toServerDateTime(form.value.startAt),
          end_at: toServerDateTime(form.value.endAt),
          icon
        }
      })
      pushToast('任务已创建', 'success')
    }
    await Promise.all([loadTaskCategories(), fetchTasks()])
    if (form.value.category) mergeCategories([form.value.category])
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
    await Promise.all([loadTaskCategories(), fetchTasks()])
    if (form.value.category) mergeCategories([form.value.category])
    pushToast('任务已删除（已进入回收站）', 'success')
  } catch {
    pushToast('任务删除失败', 'error')
  }
}

onMounted(() => {
  loadTaskCategories()
  fetchTasks()
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass task-overview">
        <div class="task-board-head">
          <div>
            <h2>任务管理</h2>
            <p class="muted">共 {{ dailyTasks.length }} 项 · 已完成 {{ dailyCompleted }} · 进行中 {{ dailyInProgress }}</p>
          </div>
          <button class="primary task-pill" @click="openCreate">新建任务</button>
        </div>

        <div class="stat-grid compact task-stat-grid">
          <div class="stat-card"><span>总任务</span><strong>{{ tasks.length }}</strong></div>
          <div class="stat-card"><span>已完成</span><strong>{{ completed }}</strong></div>
          <div class="stat-card"><span>完成度</span><strong>{{ completion }}%</strong></div>
          <div class="stat-card"><span>逾期</span><strong>{{ overdue }}</strong></div>
        </div>

        </section>

      <section class="panel glass task-list-panel">

          <div class="task-list-head">
            <div>
              <h3>任务列表</h3>
              <p class="muted">按日期查看任务</p>
            </div>
            <div class="task-date">
              <span class="date-label">日期</span>
              <input v-model="selectedDate" type="date" class="date-input" />
            </div>
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

          <div v-if="loading" class="empty-state">加载中…</div>
          <div v-else-if="error" class="empty-state">{{ error }}</div>
          <div v-else-if="!filteredTasks.length" class="empty-state">暂无任务，点击右上角新建</div>

          <ul v-else class="task-list">
            <li v-for="task in filteredTasks" :key="task.id" class="task-item">
            <div class="task-icon" @click="toggleDone(task)">
              <Icon :icon="getTaskIcon(task)" />
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
              <span class="task-status task-pill" :class="task.done && 'done'">
                {{ task.done ? '已完成' : '进行中' }}
              </span>
              <button class="ghost task-pill" @click="openEdit(task)">编辑</button>
              <button class="ghost task-pill danger" @click="removeTask(task.id, $event)">删除</button>
            </div>
          </li>
        </ul>
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

<style scoped>
.task-date {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.task-date .date-label {
  font-size: 12px;
  color: var(--text-muted);
}

.task-date .date-input {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
}

.task-stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}


.task-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}


.task-list-panel {
  display: grid;
  gap: 12px;
}

.task-overview {
  display: grid;
  gap: 16px;
}
@media (max-width: 720px) {
  .task-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .task-date {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
