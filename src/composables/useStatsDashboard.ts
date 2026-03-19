import { computed, shallowRef, ref, watch } from 'vue'
import { apiFetch } from '../api/client'

export interface StatsOverviewBlock {
  income: number
  expense: number
  balance: number
  budget_total: number
  budget_left: number
}

export interface TaskCountBlock {
  done: number
  total: number
  rate: number
}

export interface OverviewResponse {
  month: string
  range: { start: string; end: string }
  personal: StatsOverviewBlock
  family: StatsOverviewBlock
  tasks: {
    personal: TaskCountBlock
    family: TaskCountBlock
  }
}

export interface TrendPoint {
  date: string
  income: number
  expense: number
}

export interface TrendResponse {
  start: string
  end: string
  series: TrendPoint[]
}

export interface BreakdownItem {
  category_id?: number
  category?: string
  user_id?: number
  member?: string
  amount: number
  percent: number
}


export interface CategoryBreakdownResponse {
  month: string
  type: 'expense' | 'income'
  total: number
  items: Array<Required<Pick<BreakdownItem, 'amount' | 'percent'>> & { category_id: number; category: string }>
}

export interface MemberBreakdownResponse {
  month: string
  type: 'expense' | 'income'
  total: number
  items: Array<Required<Pick<BreakdownItem, 'amount' | 'percent'>> & { user_id: number; member: string }>
}

export interface BudgetCurvePoint {
  date: string
  spent: number
  target: number
}

export interface BudgetTotalResponse {
  month: string
  scope: 'total'
  target: number
  spent: number
  remaining: number
  burnCurve: BudgetCurvePoint[]
}

export interface TaskSummaryResponse {
  month: string
  done: number
  total: number
  daily: Array<{ date: string; value: number }>
}

export interface LargeExpenseItem {
  date: string
  amount: number
  category: string
  note: string
}

export interface LargeExpenseResponse {
  start: string
  end: string
  items: LargeExpenseItem[]
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function rangeFromDays(days: number) {
  const safe = Math.max(1, Math.floor(days || 1))
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (safe - 1))
  return { start: formatDate(start), end: formatDate(end) }
}

export function useStatsDashboard() {
  const month = shallowRef(currentMonth())
  const trendDays = shallowRef<number>(30)

  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)

  const overview = ref<OverviewResponse | null>(null)
  const trend = ref<TrendResponse | null>(null)
  const budgetTotal = ref<BudgetTotalResponse | null>(null)
  const categoryExpense = ref<CategoryBreakdownResponse | null>(null)
  const tasks = ref<TaskSummaryResponse | null>(null)
  const largeExpense = ref<LargeExpenseResponse | null>(null)

  const trendRange = computed(() => rangeFromDays(trendDays.value))

  async function loadAll() {
    loading.value = true
    error.value = null

    const { start, end } = trendRange.value

    try {
      const [ov, tr, bd, cb, ts, le] = await Promise.all([
        apiFetch<OverviewResponse>(`/stats/overview?month=${encodeURIComponent(month.value)}`),
        apiFetch<TrendResponse>(
          `/stats/ledger-trend?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&family=1`
        ),
        apiFetch<BudgetTotalResponse>(`/stats/budget-status?month=${encodeURIComponent(month.value)}&scope=total&family=1`),
        apiFetch<CategoryBreakdownResponse>(
          `/stats/category-breakdown?month=${encodeURIComponent(month.value)}&type=expense&limit=5&family=1`
        ),
        apiFetch<TaskSummaryResponse>(`/stats/task-summary?month=${encodeURIComponent(month.value)}&family=1`),
        apiFetch<LargeExpenseResponse>(`/stats/large-expense?limit=5`)
      ])

      overview.value = ov
      trend.value = tr
      budgetTotal.value = bd
      categoryExpense.value = cb
      tasks.value = ts
      largeExpense.value = le
    } catch (e: any) {
      error.value = e?.message || '加载失败'
    } finally {
      loading.value = false
    }
  }


  watch([month, trendDays], loadAll, { immediate: true })

  return {
    month,
    trendDays,
    trendRange,
    loading,
    error,
    overview,
    trend,
    budgetTotal,
    categoryExpense,
    tasks,
    largeExpense,
    reload: loadAll
  }
}
