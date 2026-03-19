<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'
import { useRecycleFly } from '../composables/useRecycleFly'

addCollection(mdi)

const router = useRouter()
const route = useRoute()

type TaskLedgerMode = 'auto_complete' | 'aggregate_cost'

type TaskLedgerOption = 'none' | TaskLedgerMode

type TaskLedgerSummary = {
  linked_record_count: number
  linked_expense_total: number
  linked_income_total: number
  net_expense_total: number
}

type TaskLedgerDetail = {
  task: Record<string, any>
  summary: TaskLedgerSummary
  members: Array<{ user_id?: number | null; name: string; expense: number; income: number }>
  categories: Array<{ category: string; expense: number; income: number }>
  records: Array<{
    id: string | number
    type: 'expense' | 'income'
    amount: number
    date: string
    note: string
    category: string
    nickname?: string
    account?: string
  }>
}

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
  status: 0 | 1 | 2
  icon: string
  ledgerEnabled: boolean
  ledgerMode: TaskLedgerMode
  reminderEnabled: boolean
  reminderMinutes: number
  reminderStatus: 0 | 1 | 2 | 3
  familyShared?: boolean
  linkedRecordCount: number
  linkedExpenseTotal: number
  linkedIncomeTotal: number
}

const defaultCategories = ['家庭', '工作', '健康', '学习']
const categories = ref<string[]>([...defaultCategories])
const priorities: Array<Task['priority']> = ['P1', 'P2', 'P3']
const ledgerModes: Array<{ value: TaskLedgerOption; label: string }> = [
  { value: 'none', label: '不挂账' },
  { value: 'auto_complete', label: '单次完成型' },
  { value: 'aggregate_cost', label: '多笔聚合型' }
]

const reminderMinuteOptions = [10, 15, 30, 45, 60, 90, 120]

const defaultCategoryIcons: Record<string, string> = {
  家庭: 'mdi:home-heart',
  工作: 'mdi:briefcase-outline',
  健康: 'mdi:heart-pulse',
  学习: 'mdi:book-open-page-variant',
  生活: 'mdi:sofa-outline',
  娱乐: 'mdi:gamepad-variant-outline',
  任务管理: 'mdi:clipboard-check-outline'
}

const categoryIcons = ref<Record<string, string>>({ ...defaultCategoryIcons })

const resolveCategoryIcon = (category: string) =>
  categoryIcons.value[category] || defaultCategoryIcons[category] || 'mdi:checkbox-marked-circle-outline'

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

const getLedgerModeLabel = (mode: TaskLedgerMode) =>
  mode === 'aggregate_cost' ? '多笔聚合型' : '单次完成型'

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
  return normalized.length === 16 ? `${normalized}:00` : normalized
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
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  return {
    startAt: formatLocal(now),
    endAt: formatLocal(end)
  }
}

const toLocalDateKey = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const formatAmount = (value: number | string) => Number(value || 0).toFixed(2)

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

const getTaskStatus = (task: Task): 0 | 1 | 2 => {
  if (task.done) return 1
  if (task.status === 1) return 1
  if (task.status === 2) return 2
  return 0
}

const getTaskStatusLabel = (task: Task) => {
  const status = getTaskStatus(task)
  if (status === 1) return '已完成'
  if (status === 2) return '逾期'
  return '进行中'
}

const getReminderStatusLabel = (task: Task) => {
  if (!task.reminderEnabled) return '提醒关闭'
  if (task.reminderStatus === 1) return '已提醒'
  if (task.reminderStatus === 3) return '提醒失败'
  if (task.reminderStatus === 0) return `待提醒（提前${task.reminderMinutes}分钟）`
  return '无需提醒'
}

const dailyCompleted = computed(() => dailyTasks.value.filter((t) => getTaskStatus(t) === 1).length)
const dailyInProgress = computed(() => dailyTasks.value.filter((t) => getTaskStatus(t) === 0).length)
const dailyOverdue = computed(() => dailyTasks.value.filter((t) => getTaskStatus(t) === 2).length)
const loading = shallowRef(false)
const error = shallowRef('')

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done' | 'overdue'>('all')
const priorityFilter = ref<'all' | Task['priority']>('all')
const modalOpen = ref(false)
const detailOpen = ref(false)
const detailLoading = shallowRef(false)
const detailData = ref<TaskLedgerDetail | null>(null)
const editingId = ref<string | number | null>(null)

const { flyToRecycle } = useRecycleFly()
const form = ref<{
  title: string
  category: string
  priority: Task['priority']
  startAt: string
  endAt: string
  icon: string
  ledgerOption: TaskLedgerOption
  reminderEnabled: boolean
  reminderMinutes: number
}>({
  title: '',
  category: categories.value[0] ?? '家庭',
  priority: priorities[1] ?? 'P2',
  startAt: '',
  endAt: '',
  icon: resolveCategoryIcon(categories.value[0] ?? '家庭'),
  ledgerOption: 'none',
  reminderEnabled: false,
  reminderMinutes: 60
})

const loadTaskCategories = async () => {
  try {
    const data = await apiFetch<any[]>('/tasks/categories')
    if (Array.isArray(data) && data.length) {
      const names: string[] = []
      const nextIcons: Record<string, string> = { ...defaultCategoryIcons }
      data.forEach((item) => {
        const name = (item?.name ?? item?.category ?? item) as string
        if (typeof name === 'string' && name.trim()) {
          const key = name.trim()
          names.push(key)
          const icon = (item?.icon ?? item?.category_icon ?? item?.categoryIcon) as string
          if (icon && icon.trim()) {
            nextIcons[key] = icon.trim()
          }
        }
      })
      const merged = new Set([...defaultCategories, ...names])
      categories.value = Array.from(merged)
      categoryIcons.value = nextIcons
    } else {
      categories.value = [...defaultCategories]
    }
  } catch {
    categories.value = [...defaultCategories]
  }

  if (!categories.value.includes(form.value.category)) {
    form.value.category = categories.value[0] ?? '家庭'
  }
}

const filteredTasks = computed(() => {
  return dailyTasks.value.filter((task) => {
    const hitQuery = task.title.includes(query.value.trim())
    const currentStatus = getTaskStatus(task)
    const hitStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'done' && currentStatus === 1) ||
      (statusFilter.value === 'todo' && currentStatus === 0) ||
      (statusFilter.value === 'overdue' && currentStatus === 2)
    const hitPriority =
      priorityFilter.value === 'all' || task.priority === priorityFilter.value
    return hitQuery && hitStatus && hitPriority
  })
})

const completed = computed(() => tasks.value.filter((t) => getTaskStatus(t) === 1).length)
const completion = computed(() =>
  tasks.value.length ? Math.round((completed.value / tasks.value.length) * 100) : 0
)
const overdue = computed(() => tasks.value.filter((t) => getTaskStatus(t) === 2).length)

const openCreate = () => {
  editingId.value = null
  const { startAt, endAt } = buildDefaultRange()
  form.value = {
    title: '',
    category: categories.value[0] ?? '家庭',
    priority: priorities[1] ?? 'P2',
    startAt,
    endAt,
    icon: resolveCategoryIcon(categories.value[0] ?? '家庭'),
    ledgerOption: 'none',
    reminderEnabled: false,
    reminderMinutes: 60
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
    icon: getTaskIcon(task),
    ledgerOption: task.ledgerEnabled ? task.ledgerMode : 'none',
    reminderEnabled: task.reminderEnabled,
    reminderMinutes: task.reminderMinutes || 60
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
      const statusRaw = Number(item.status ?? item.task_status ?? 0)
      const status = statusRaw === 1 ? 1 : statusRaw === 2 ? 2 : 0
      const reminderStatusRaw = Number(item.reminder_status ?? item.reminderStatus ?? 2)
      const reminderStatus =
        reminderStatusRaw === 0 ? 0 : reminderStatusRaw === 1 ? 1 : reminderStatusRaw === 3 ? 3 : 2
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
        status,
        icon: normalizeTaskIcon(item.icon, item.category),
        ledgerEnabled: Boolean(item.ledger_enabled ?? item.ledgerEnabled ?? 0),
        ledgerMode: (item.ledger_mode ?? item.ledgerMode ?? 'auto_complete') as TaskLedgerMode,
        reminderEnabled: Boolean(item.reminder_enabled ?? item.reminderEnabled ?? 0),
        reminderMinutes: Number(item.reminder_minutes ?? item.reminderMinutes ?? 60),
        reminderStatus,
        familyShared: Boolean(item.family_shared ?? item.familyShared),
        linkedRecordCount: Number(item.linked_record_count ?? item.linkedRecordCount ?? 0),
        linkedExpenseTotal: Number(item.linked_expense_total ?? item.linkedExpenseTotal ?? 0),
        linkedIncomeTotal: Number(item.linked_income_total ?? item.linkedIncomeTotal ?? 0)
      }
    })
    syncCategoriesFromTasks()
  } catch (err: any) {
    error.value = err?.message || '任务加载失败'
  } finally {
    loading.value = false
  }
}

const openLedgerDetail = async (task: Task) => {
  detailOpen.value = true
  detailLoading.value = true
  detailData.value = null
  try {
    const data = await apiFetch<TaskLedgerDetail>(`/tasks/${task.id}/ledger-summary`)
    detailData.value = data
  } catch (err: any) {
    pushToast(err?.message || '任务花费加载失败', 'error')
  } finally {
    detailLoading.value = false
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
    const icon = normalizeTaskIcon(form.value.icon, form.value.category)
    const ledgerEnabled = form.value.ledgerOption !== 'none'
    const ledgerMode = ledgerEnabled ? form.value.ledgerOption : 'auto_complete'
    const reminderMinutes = Math.max(0, Number(form.value.reminderMinutes || 0))

    const body = {
      title: form.value.title,
      category: form.value.category,
      priority: form.value.priority,
      start_at: toServerDateTime(form.value.startAt),
      end_at: toServerDateTime(form.value.endAt),
      ledger_enabled: ledgerEnabled ? 1 : 0,
      ledger_mode: ledgerMode,
      reminder_enabled: form.value.reminderEnabled ? 1 : 0,
      reminder_minutes: reminderMinutes,
      icon
    }

    if (editingId.value) {
      await apiFetch(`/tasks/${editingId.value}`, {
        method: 'PATCH',
        body
      })
      pushToast('任务已更新', 'success')
    } else {
      await apiFetch('/tasks', {
        method: 'POST',
        body
      })
      pushToast('任务已创建', 'success')
    }

    await Promise.all([loadTaskCategories(), fetchTasks()])
    if (form.value.category) mergeCategories([form.value.category])
    modalOpen.value = false
  } catch (err: any) {
    pushToast(err?.message || '任务保存失败', 'error')
  }
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

onMounted(async () => {
  await loadTaskCategories()
  await fetchTasks()

  if (route.query.create === '1') {
    openCreate()
    const { create, ...rest } = route.query
    router.replace({ query: rest })
  }
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
            <p class="muted">共 {{ dailyTasks.length }} 项 · 已完成 {{ dailyCompleted }} · 进行中 {{ dailyInProgress }} · 逾期 {{ dailyOverdue }}</p>
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
          </div>

          <div class="task-toolbar">
            <div class="task-filters">
              <div class="task-date task-filter-date">
                <span class="date-label">日期</span>
                <el-date-picker
                  v-model="selectedDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  :clearable="false"
                  class="date-input"
                />
              </div>
              <select v-model="statusFilter" class="task-filter-status">
                <option value="all">全部</option>
                <option value="todo">待办</option>
                <option value="done">已完成</option>
                <option value="overdue">逾期</option>
              </select>
              <div class="search task-filter-search">
                <Icon icon="mdi:magnify" />
                <input v-model="query" placeholder="搜索任务" />
              </div>
              <select v-model="priorityFilter" class="task-filter-priority">
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
                <span class="tag">{{ task.ledgerEnabled ? getLedgerModeLabel(task.ledgerMode) : '不挂账' }}</span>
                <span class="tag">{{ getReminderStatusLabel(task) }}</span>
                <span class="tag">已关联 {{ task.linkedRecordCount }} 笔 · 支出 ¥{{ formatAmount(task.linkedExpenseTotal) }}</span>
              </div>
            </div>
            <div class="task-actions">
              <span
                class="task-status task-pill"
                :class="{
                  done: getTaskStatus(task) === 1,
                  overdue: getTaskStatus(task) === 2
                }"
              >
                {{ getTaskStatusLabel(task) }}
              </span>
              <button class="ghost task-pill" @click="openLedgerDetail(task)">花费</button>
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
              <select v-model="form.category">
                <option v-for="item in categories" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select v-model="form.priority">
                <option v-for="item in priorities" :key="item" :value="item">{{ item }}</option>
              </select>
            </label>
            <label>
              <span>挂账</span>
              <select v-model="form.ledgerOption">
                <option v-for="item in ledgerModes" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label>
              <span>开始</span>
              <el-date-picker
                v-model="form.startAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm"
                :clearable="false"
              />
            </label>
            <label>
              <span>结束</span>
              <el-date-picker
                v-model="form.endAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm"
                :clearable="false"
              />
            </label>
            <label>
              <span>任务提醒</span>
              <select v-model="form.reminderEnabled">
                <option :value="false">不提醒</option>
                <option :value="true">需要提醒</option>
              </select>
            </label>
            <label v-if="form.reminderEnabled">
              <span>提前提醒</span>
              <select v-model.number="form.reminderMinutes">
                <option v-for="minutes in reminderMinuteOptions" :key="minutes" :value="minutes">
                  提前 {{ minutes }} 分钟
                </option>
              </select>
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
      <div v-if="detailOpen" class="modal-backdrop" @click.self="detailOpen = false">
        <div class="modal task-ledger-modal">
          <div class="modal-head">
            <h3>任务花费</h3>
            <button class="ghost" @click="detailOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <div v-if="detailLoading" class="empty-state">加载中…</div>
            <div v-else-if="detailData" class="task-ledger-body">
              <div class="task-ledger-summary">
                <div class="summary-title">{{ detailData.task?.title || '任务花费' }}</div>
                <div class="summary-row">
                  <span>关联 {{ detailData.summary.linked_record_count }} 笔</span>
                  <span>支出 ¥{{ formatAmount(detailData.summary.linked_expense_total) }}</span>
                  <span>收入 ¥{{ formatAmount(detailData.summary.linked_income_total) }}</span>
                  <span>净支出 ¥{{ formatAmount(detailData.summary.net_expense_total) }}</span>
                </div>
              </div>

              <div class="task-ledger-section">
                <div class="section-title">成员花费</div>
                <div class="task-ledger-list">
                  <div v-for="item in detailData.members" :key="item.name" class="task-ledger-row">
                    <span>{{ item.name }}</span>
                    <span>支出 ¥{{ formatAmount(item.expense) }}</span>
                    <span>收入 ¥{{ formatAmount(item.income) }}</span>
                  </div>
                </div>
              </div>

              <div class="task-ledger-section">
                <div class="section-title">分类汇总</div>
                <div class="task-ledger-list">
                  <div v-for="item in detailData.categories" :key="item.category" class="task-ledger-row">
                    <span>{{ item.category }}</span>
                    <span>支出 ¥{{ formatAmount(item.expense) }}</span>
                    <span>收入 ¥{{ formatAmount(item.income) }}</span>
                  </div>
                </div>
              </div>

              <div class="task-ledger-section">
                <div class="section-title">关联流水</div>
                <div class="task-ledger-list">
                  <div v-for="item in detailData.records" :key="item.id" class="task-ledger-row">
                    <span>{{ item.date }}</span>
                    <span>{{ item.note || '记账记录' }}</span>
                    <span>{{ item.category }}</span>
                    <span>{{ item.type === 'income' ? '+' : '-' }}¥{{ formatAmount(item.amount) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">暂无数据</div>
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
  white-space: nowrap;
  line-height: 1;
}

.task-date .date-input {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  width: 136px;
  flex: 1;
  min-width: 0;
}

.task-date :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  border: 0;
  padding: 0;
}

.task-date :deep(.el-input__inner) {
  color: var(--text);
  font-size: 12px;
}

.task-date :deep(.el-input__prefix-inner) {
  color: var(--text-muted);
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

.task-ledger-modal {
  width: min(860px, 92vw);
}

.task-ledger-body {
  display: grid;
  gap: 16px;
}

.task-ledger-summary {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.summary-title {
  font-weight: 600;
  font-size: 16px;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--text-muted);
  font-size: 12px;
}

.task-ledger-section {
  display: grid;
  gap: 8px;
}

.task-ledger-section .section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.task-ledger-list {
  display: grid;
  gap: 8px;
}

.task-ledger-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 86%, transparent);
}

@media (max-width: 720px) {
  .task-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .task-date {
    width: 100%;
    justify-content: space-between;
  }
  .task-ledger-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
