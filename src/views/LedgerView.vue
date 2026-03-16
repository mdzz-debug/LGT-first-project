<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'
import MemberSpendCompare from '../components/MemberSpendCompare.vue'
import WaffleGrid from '../components/WaffleGrid.vue'
import CategorySelect from '../components/ledger/CategorySelect.vue'
import type { CategoryOption } from '../components/ledger/CategorySelect.vue'
import { buildWaffle } from '../utils/waffle'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'
import { useRecycleFly } from '../composables/useRecycleFly'

addCollection(mdi)

const defaultCategories = ['餐饮', '交通', '居家', '教育', '娱乐', '工资', '红包', '奖金', '报销', '退款', '收款', '上缴', '其他']
const defaultCategoryIcons: Record<string, string> = {
  餐饮: 'mdi:food',
  交通: 'mdi:train-car',
  居家: 'mdi:home',
  教育: 'mdi:school',
  娱乐: 'mdi:movie-open',
  医疗: 'mdi:medical-bag',
  购物: 'mdi:cart',
  服饰: 'mdi:tshirt-crew',
  美妆: 'mdi:lipstick',
  工资: 'mdi:briefcase',
  红包: 'mdi:gift',
  奖金: 'mdi:trophy',
  报销: 'mdi:file-check',
  退款: 'mdi:cash-refund',
  收款: 'mdi:cash-plus',
  上缴: 'mdi:bank-transfer',
  其他: 'mdi:dots-horizontal'
}
const categories = ref<string[]>([...defaultCategories])
const categoryIcons = ref<Record<string, string>>({ ...defaultCategoryIcons })
const types = ['expense', 'income'] as const

type LedgerType = (typeof types)[number]

type LedgerAllocation = {
  memberId?: string | number
  memberName?: string
  amount: number
}

type AllocationDraft = {
  memberId: string
  amount: number
}

type LedgerRecord = {
  id: string | number
  type: LedgerType
  category: string
  categoryId?: string | number
  categoryIcon?: string
  amount: number
  date: string
  note: string
  memberId?: string | number
  allocations?: LedgerAllocation[]
  recordKind?: string
  sourceUserName?: string
  sourceNote?: string
}

type FamilySummary = {
  month: string
  expenseTotal: number
  incomeTotal: number
  members: Array<{
    id: string | number
    name: string
    avatar?: string | null
    expense: number
    income: number
  }>
  categories: Array<{
    category: string
    total: number
  }>
}

const compareMonth = shallowRef(new Date().toISOString().slice(0, 7))
const currentMemberName = ref('我')
const records = ref<LedgerRecord[]>([])
const loading = shallowRef(false)
const error = shallowRef('')
const familySummary = ref<FamilySummary>({
  month: compareMonth.value,
  expenseTotal: 0,
  incomeTotal: 0,
  members: [],
  categories: []
})

const query = ref('')
const filterType = ref<'all' | 'expense' | 'income'>('all')
const filterCategory = ref('all')

const getCategoryIcon = (name: string) =>
  categoryIcons.value[name] ?? defaultCategoryIcons[name] ?? 'mdi:tag-outline'

const getAllocationSum = (record: LedgerRecord) =>
  (record.allocations ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)

const getSelfIncome = (record: LedgerRecord) => Math.max(0, record.amount - getAllocationSum(record))

const categorySelectOptions = computed<CategoryOption[]>(() =>
  categories.value.map((name) => ({ value: name, label: name, icon: getCategoryIcon(name) }))
)

const filterCategoryOptions = computed<CategoryOption[]>(() => [
  { value: 'all', label: '全部分类', icon: 'mdi:apps' },
  ...categorySelectOptions.value
])

const toLocalDateKey = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const selectedDate = shallowRef(toLocalDateKey(new Date()))

const modalOpen = ref(false)
const familyOverviewOpen = ref(false)
const allocationModalOpen = ref(false)
const allocationTarget = ref<LedgerRecord | null>(null)

const { flyToRecycle } = useRecycleFly()
const familyTab = ref<'expense' | 'income' | 'category'>('category')
const editingId = ref<string | number | null>(null)

const ledgerMembers = ref<Array<{ id: string | number; name: string }>>([])

const form = ref({
  type: 'expense' as LedgerType,
  category: categories.value[0] ?? '其他',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  note: '',
  allocations: [] as AllocationDraft[]
})

const dailyRecords = computed(() =>
  records.value.filter((item) => item.date === selectedDate.value)
)

const filtered = computed(() => {
  return dailyRecords.value.filter((item) => {
    const hitQuery = item.note.includes(query.value.trim())
    const hitType = filterType.value === 'all' || item.type === filterType.value
    const hitCategory = filterCategory.value === 'all' || item.category === filterCategory.value
    return hitQuery && hitType && hitCategory
  })
})


const totalIncome = computed(() =>
  records.value
    .filter((r) => r.type === 'income')
    .reduce((sum, r) => {
      const alloc = (r.allocations ?? []).reduce((acc, row) => acc + Number(row.amount || 0), 0)
      return sum + (r.amount - alloc)
    }, 0)
)
const totalExpense = computed(() =>
  records.value.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0)
)

const budget = ref({
  month: '',
  targetAmount: 0,
  expenseAmount: 0,
  balance: 0,
  ratio: 0,
  frozen: false
})
const budgetModalOpen = ref(false)
const budgetAmount = ref(0)
const budgetLogs = ref<Array<{ amount: number; created_at: string }>>([])

const monthlyExpense = computed(() => (budget.value.expenseAmount || 0) || totalExpense.value)
const balance = computed(() => (budget.value.balance ?? 0))

const familyMembers = computed(() => {
  if (familySummary.value.members.length) {
    return familySummary.value.members.map((member) => ({
      id: member.id,
      name: member.name,
      avatar: member.avatar ?? null
    }))
  }
  return [
    {
      id: 'self',
      name: currentMemberName.value,
      avatar: null
    }
  ]
})

const familySummaryRecords = computed(() => {
  if (!familySummary.value.members.length) {
    return records.value.map((item) => ({
      ...item,
      memberId: item.memberId ?? 'self'
    }))
  }
  const month = familySummary.value.month || compareMonth.value
  const date = `${month}-01`
  const rows: LedgerRecord[] = []
  familySummary.value.members.forEach((member) => {
    if (member.expense > 0) {
      rows.push({
        id: `expense-${member.id}`,
        type: 'expense',
        category: '家庭',
        amount: member.expense,
        date,
        note: '家庭支出',
        memberId: member.id
      })
    }
    if (member.income > 0) {
      rows.push({
        id: `income-${member.id}`,
        type: 'income',
        category: '家庭',
        amount: member.income,
        date,
        note: '家庭收入',
        memberId: member.id
      })
    }
  })
  return rows
})

const familyCategoryTotals = computed(() => {
  const totals = categories.value.map((cat) => {
    const row = familySummary.value.categories.find((item) => item.category === cat)
    const total = row ? Number(row.total) : 0
    return { category: cat, total }
  })
  const max = Math.max(1, ...totals.map((row) => row.total))
  return totals.map((row) => ({
    ...row,
    percent: Math.round((row.total / max) * 100)
  }))
})

const chartPalette = ['#f97316', '#fb7185', '#facc15', '#34d399', '#60a5fa', '#a78bfa', '#f59e0b', '#22c55e']

const formatAmount = (value: number | string) => Number(value || 0).toFixed(2)

const categoryChart = computed(() => {
  const totals = new Map<string, number>()
  categories.value.forEach((cat) => totals.set(cat, 0))
  records.value.forEach((r) => {
    if (r.type !== 'expense') return
    const key = r.category || '其他'
    totals.set(key, (totals.get(key) ?? 0) + Number(r.amount))
  })
  const list = Array.from(totals.entries())
    .map(([category, total], idx) => ({
      category,
      total,
      color: chartPalette[idx % chartPalette.length],
      icon: getCategoryIcon(category)
    }))
    .filter((item) => item.total > 0)

  if (!list.length) return []
  const max = Math.max(1, ...list.map((item) => item.total))
  return list
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      ...item,
      percent: Math.round((item.total / max) * 100)
    }))
})

const categoryWaffle = computed(() =>
  buildWaffle(
    categoryChart.value.map((item) => ({
      label: item.category,
      amount: item.total,
      color: item.color ?? '#cbd5f5',
      icon: item.icon
    }))
  )
)

const familyWaffle = computed(() =>
  buildWaffle(
    familyCategoryTotals.value
      .filter((row) => row.total > 0)
      .map((row, idx) => ({
        label: row.category,
        amount: row.total,
        color: chartPalette[idx % chartPalette.length] || '#cbd5f5',
        icon: getCategoryIcon(row.category)
      }))
  )
)

const fetchRecords = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await apiFetch<any[]>('/ledger/records')
    records.value = data.map((item) => {
      const category = item.category
      const categoryIcon =
        item.category_icon ??
        item.categoryIcon ??
        categoryIcons.value[category] ??
        defaultCategoryIcons[category] ??
        undefined

      return {
        id: item.id,
        type: item.type,
        category,
        categoryId: item.category_id ?? item.categoryId ?? item.categoryID,
        categoryIcon,
        amount: Number(item.amount),
        date: item.date,
        note: item.note ?? '',
        memberId: item.member_id ?? item.memberId ?? 'self',
        allocations: Array.isArray(item.allocations) ? item.allocations : [],
        recordKind: item.record_kind ?? item.recordKind,
        sourceUserName: item.source_user_name ?? item.sourceUserName,
        sourceNote: item.source_note ?? item.sourceNote
      }
    })
  } catch (err: any) {
    error.value = err?.message || '记账加载失败'
  } finally {
    loading.value = false
  }
}

const fetchFamilySummary = async () => {
  try {
    const data = await apiFetch<any>(`/ledger/family/summary?month=${compareMonth.value}`)
    familySummary.value = {
      month: data.month,
      expenseTotal: Number(data.expenseTotal ?? 0),
      incomeTotal: Number(data.incomeTotal ?? 0),
      members: (data.members ?? []).map((member: any) => ({
        id: member.id ?? member.memberId ?? 'self',
        name: member.name ?? member.memberName ?? currentMemberName.value,
        avatar: member.avatar ?? null,
        expense: Number(member.expense ?? 0),
        income: Number(member.income ?? 0)
      })),
      categories: data.categories ?? []
    }
  } catch {
    // ignore
  }
}

const fetchLedgerMembers = async () => {
  try {
    const data = await apiFetch<any[]>('/ledger/members')
    if (Array.isArray(data)) {
      ledgerMembers.value = data
        .map((item) => ({
          id: item.id ?? item.userId,
          name: (item.nickname ?? item.account ?? '').trim()
        }))
        .filter((item) => item.id && item.name)
    }
  } catch {
    ledgerMembers.value = []
  }
}

const fetchBudget = async () => {
  try {
    const data = await apiFetch<any>('/ledger/budget')
    budget.value = {
      month: data.month,
      targetAmount: Number(data.targetAmount ?? 0),
      expenseAmount: Number(data.expenseAmount ?? 0),
      balance: Number(data.balance ?? 0),
      ratio: Number(data.ratio ?? 0),
      frozen: Boolean(data.frozen)
    }
    budgetAmount.value = budget.value.targetAmount
  } catch {
    // ignore
  }
}

const fetchBudgetLogs = async () => {
  if (!budget.value.month) return
  try {
    const data = await apiFetch<any[]>(`/ledger/budget/logs?month=${budget.value.month}`)
    budgetLogs.value = (data ?? []).map((row) => ({
      amount: Number(row.amount ?? 0),
      created_at: row.created_at
    }))
  } catch {
    budgetLogs.value = []
  }
}

const openBudgetModal = async () => {
  budgetAmount.value = budget.value.targetAmount
  budgetModalOpen.value = true
  await fetchBudgetLogs()
}

const saveBudget = async () => {
  try {
    await apiFetch('/ledger/budget', {
      method: 'POST',
      body: { month: budget.value.month, amount: budgetAmount.value }
    })
    await fetchBudget()
    await fetchBudgetLogs()
    budgetModalOpen.value = false
    pushToast('目标已更新', 'success')
  } catch (err: any) {
    pushToast(err?.message || '目标更新失败', 'error')
  }
}

const fetchCategories = async () => {
  try {
    const data = await apiFetch<any[]>('/ledger/categories')

    const base = [...defaultCategories]
    const nextIcons: Record<string, string> = { ...defaultCategoryIcons }

    if (Array.isArray(data) && data.length) {
      const names: string[] = []
      data.forEach((item) => {
        const name = (item?.name ?? item?.category ?? item) as any
        if (typeof name === 'string' && name.trim()) {
          names.push(name.trim())
          const icon = (item?.icon ?? item?.category_icon ?? item?.categoryIcon) as any
          if (typeof icon === 'string' && icon.trim()) {
            nextIcons[name.trim()] = icon.trim()
          }
        }
      })

      const extra = names.filter((name) => !base.includes(name))
      const merged = [...base, ...extra]
      if (!merged.includes('其他')) merged.push('其他')
      categories.value = Array.from(new Set(merged))
    } else {
      if (!base.includes('其他')) base.push('其他')
      categories.value = base
    }

    categoryIcons.value = nextIcons
  } catch {
    categories.value = [...defaultCategories]
    if (!categories.value.includes('其他')) categories.value.push('其他')
    categoryIcons.value = { ...defaultCategoryIcons }
  }

  if (!categories.value.includes(form.value.category)) {
    form.value.category = categories.value[0] ?? '其他'
  }
}

const loadCurrentMember = async () => {
  const cached = localStorage.getItem('pulse.user')
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      currentMemberName.value = parsed.nickname || currentMemberName.value
    } catch {
      // ignore
    }
  }
  try {
    const user = await apiFetch<any>('/users/me')
    currentMemberName.value = user.nickname || currentMemberName.value
  } catch {
    // ignore
  }
}

const openFamilyOverview = () => {
  familyOverviewOpen.value = true
}

const openCreate = () => {
  editingId.value = null
  form.value = {
    type: 'expense',
    category: categories.value[0] ?? '其他',
    amount: 0,
    date: toLocalDateKey(new Date()),
    note: '',
    allocations: []
  }
  modalOpen.value = true
}

const openEdit = (item: LedgerRecord) => {
  editingId.value = item.id
  form.value = {
    type: item.type,
    category: item.category,
    amount: item.amount,
    date: item.date,
    note: item.note,
    allocations: (item.allocations ?? []).map((row) => ({
      memberId: String(row.memberId ?? ''),
      amount: Number(row.amount || 0)
    }))
  }
  modalOpen.value = true
}

const allocationTotal = computed(() =>
  (form.value.allocations ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
)

const allocationRemaining = computed(() => Math.max(0, Number(form.value.amount || 0) - allocationTotal.value))

const memberOptions = computed<CategoryOption[]>(() =>
  ledgerMembers.value.map((m) => ({ value: String(m.id), label: m.name, icon: 'mdi:account' }))
)

const addAllocation = () => {
  form.value.allocations.push({ memberId: memberOptions.value[0]?.value ?? '', amount: 0 })
}

const removeAllocation = (index: number) => {
  form.value.allocations.splice(index, 1)
}

const openAllocationModal = (item: LedgerRecord) => {
  allocationTarget.value = item
  allocationModalOpen.value = true
}


const saveRecord = async () => {
  if (!form.value.note.trim()) return

  if (form.value.type === 'income' && allocationTotal.value - Number(form.value.amount || 0) > 0.0001) {
    pushToast('分配金额不能超过收入', 'error')
    return
  }

  const payload: any = {
    type: form.value.type,
    category: form.value.category,
    amount: form.value.amount,
    date: form.value.date,
    note: form.value.note
  }

  if (form.value.type === 'income') {
    payload.allocations = (form.value.allocations ?? [])
      .filter((row) => row.memberId && Number(row.amount || 0) > 0)
      .map((row) => ({
        memberId: Number(row.memberId),
        amount: Number(row.amount)
      }))
  }

  try {
    if (editingId.value) {
      await apiFetch(`/ledger/records/${editingId.value}`, {
        method: 'PATCH',
        body: payload
      })
      pushToast('记账已更新', 'success')
    } else {
      await apiFetch('/ledger/records', {
        method: 'POST',
        body: payload
      })
      pushToast('记账已创建', 'success')
    }
    await fetchRecords()
    await fetchFamilySummary()
  } catch {
    pushToast('记账保存失败', 'error')
  }
  modalOpen.value = false
}

const removeRecord = async (id: string | number, evt?: MouseEvent) => {
  if (typeof window !== 'undefined') {
    const ok = window.confirm('确认删除该记录吗？')
    if (!ok) return
  }
  const sourceEl = (evt?.currentTarget as HTMLElement | null)?.closest('.ledger-item') as HTMLElement | null
  flyToRecycle(sourceEl)
  try {
    await apiFetch(`/ledger/records/${id}`, { method: 'DELETE' })
    await fetchRecords()
    await fetchFamilySummary()
    pushToast('记账已删除（已进入回收站）', 'success')
  } catch {
    pushToast('记账删除失败', 'error')
  }
}

watch(compareMonth, () => {
  fetchFamilySummary()
})

onMounted(async () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('family') === '1') {
      familyOverviewOpen.value = true
    }
  }
  await Promise.all([
    loadCurrentMember(),
    fetchCategories(),
    fetchRecords(),
    fetchFamilySummary(),
    fetchLedgerMembers(),
    fetchBudget()
  ])
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content ledger-content">
      <section class="panel glass ledger-overview">
        <div class="task-board-head">
          <div>
            <h2>记账板块</h2>
            <p class="muted">本月收支与分类概览</p>
          </div>
          <div class="ledger-actions">
            <button class="ghost task-pill header-pill" @click="openFamilyOverview">家庭概览</button>
            <button class="primary header-pill" @click="openCreate">新增记录</button>
          </div>
        </div>

        <div class="stat-grid compact ledger-stat-grid">
          <div class="stat-card">
            <span>本月收入</span>
            <strong>¥ {{ formatAmount(totalIncome) }}</strong>
          </div>
          <div class="stat-card">
            <span>本月支出</span>
            <strong>¥ {{ formatAmount(monthlyExpense) }}</strong>
          </div>
          <div class="stat-card clickable" @click="openBudgetModal">
            <span>结余</span>
            <strong>¥ {{ formatAmount(balance) }}</strong>
            <small class="muted">目标 ¥{{ formatAmount(budget.targetAmount) }}</small>
          </div>
          <div class="stat-card">
            <span>记录数</span>
            <strong>{{ records.length }}</strong>
          </div>
        </div>

        <div v-if="categoryWaffle.legend.length" class="ledger-chart grid-chart">
          <div class="chart-summary">
            <span class="kicker">支出分布</span>
            <h3>¥ {{ formatAmount(totalExpense) }}</h3>
            <p class="muted">本月支出总额</p>
          </div>
          <WaffleGrid
            :tiles="categoryWaffle.tiles"
            :legend="categoryWaffle.legend"
            :amount-formatter="formatAmount"
            :size="220"
          />
        </div>
        <div v-else class="rose-empty">暂无支出数据</div>
      </section>

      <section class="panel glass ledger-list-panel">
        <div class="task-board-head ledger-list-head">
          <div>
            <h3>记账记录</h3>
            <p class="muted">共 {{ dailyRecords.length }} 条</p>
          </div>
        </div>

        <div class="task-tools">
          <div class="ledger-date task-date">
            <span class="date-label">日期</span>
            <input v-model="selectedDate" type="date" class="date-input" />
          </div>
          <select v-model="filterType" class="task-type">
            <option value="all">全部</option>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <div class="search task-search">
            <input v-model="query" placeholder="搜索备注" />
          </div>
          <CategorySelect v-model="filterCategory" :options="filterCategoryOptions" class="task-category" />
        </div>

        <div v-if="loading" class="empty-state">加载中…</div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>
        <div v-else-if="!filtered.length" class="empty-state">暂无当天记账记录</div>

        <div v-else class="ledger-list">
          <div v-for="item in filtered" :key="item.id" class="ledger-item">
            <div>
              <h4>{{ item.note }}</h4>
              <p class="muted">
                <span class="ledger-cat">
                  <Icon class="ledger-cat-icon" :icon="item.categoryIcon || getCategoryIcon(item.category)" />
                  <span>{{ item.category }}</span>
                </span>
                · {{ item.date }}
              </p>
              <p v-if="item.recordKind === 'allocation_in' && item.sourceNote" class="muted alloc-source">
                来源：{{ item.sourceNote }}
              </p>

            </div>
            <div class="ledger-amount" :class="item.type">
              {{ item.type === 'income' ? '+' : '-' }}¥{{ item.amount }}
            </div>
            <div class="ledger-actions">
              <button
                v-if="item.type === 'income' && (item.allocations?.length || 0) > 0"
                class="ghost task-pill icon-only"
                @click="openAllocationModal(item)"
                title="查看分配详情"
              >
                <Icon icon="mdi:account-group" />
              </button>
              <template v-if="item.recordKind !== 'allocation_in'">
                <button class="ghost task-pill" @click="openEdit(item)">编辑</button>
                <button class="ghost task-pill danger" @click="removeRecord(item.id, $event)">删除</button>
              </template>
            </div>
          </div>
        </div>
      </section>
    </main>

    <Transition name="backdrop-fade">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>{{ editingId ? '编辑记录' : '新增记录' }}</h3>
            <button class="ghost" @click="modalOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <label>
              <span>类型</span>
              <select v-model="form.type">
                <option v-for="t in types" :key="t" :value="t">{{ t === 'expense' ? '支出' : '收入' }}</option>
              </select>
            </label>
            <label>
              <span>分类</span>
              <CategorySelect v-model="form.category" :options="categorySelectOptions" />
            </label>
            <label>
              <span>金额</span>
              <input v-model.number="form.amount" type="number" min="0" />
            </label>

            <div v-if="form.type === 'income'" class="alloc-editor">
              <div class="alloc-head">
                <div>
                  <div class="alloc-head-title">收入分配</div>
                  <div class="muted">分配给成员的金额会记到成员收入；剩余为你自己的收入</div>
                </div>
                <button class="ghost task-pill" @click="addAllocation">新增分配</button>
              </div>

              <div class="alloc-stats">
                <span class="alloc-pill">已分配 ¥{{ formatAmount(allocationTotal) }}</span>
                <span class="alloc-pill">剩余（自己）¥{{ formatAmount(allocationRemaining) }}</span>
              </div>

              <div class="alloc-rows">
                <div v-for="(row, idx) in form.allocations" :key="idx" class="alloc-row">
                  <CategorySelect v-model="row.memberId" :options="memberOptions" />
                  <input v-model.number="row.amount" type="number" min="0" placeholder="金额" class="alloc-amt" />
                  <button class="ghost task-pill danger" @click="removeAllocation(idx)">删除</button>
                </div>

                <div v-if="!form.allocations.length" class="empty-state">暂无分配，全部收入记为你自己</div>
              </div>

              <div class="muted">成员列表来自系统用户（users），如需新增成员请先注册/创建用户</div>
            </div>

            <label>
              <span>日期</span>
              <input v-model="form.date" type="date" />
            </label>
            <label>
              <span>备注</span>
              <input v-model="form.note" placeholder="例如：午餐" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="modalOpen = false">取消</button>
            <button class="primary" @click="saveRecord">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="backdrop-fade">
      <div v-if="allocationModalOpen && allocationTarget" class="modal-backdrop" @click.self="allocationModalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>分配详情</h3>
            <button class="ghost" @click="allocationModalOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <div class="alloc-detail-head">
              <div class="alloc-detail-title">{{ allocationTarget.note }}</div>
              <div class="muted">{{ allocationTarget.date }} · ¥{{ formatAmount(allocationTarget.amount) }}</div>
            </div>
            <div class="alloc-lines">
              <div v-for="(row, idx) in allocationTarget.allocations" :key="idx" class="alloc-line">
                <span class="alloc-name">{{ row.memberName || '成员' }}</span>
                <span class="alloc-amount">¥{{ formatAmount(row.amount) }}</span>
              </div>
              <div class="alloc-line self">
                <span class="alloc-name">未分配（自己）</span>
                <span class="alloc-amount">¥{{ formatAmount(getSelfIncome(allocationTarget)) }}</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="primary" @click="allocationModalOpen = false">知道了</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="backdrop-fade">
      <div v-if="budgetModalOpen" class="modal-backdrop" @click.self="budgetModalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>设置当月目标</h3>
            <button class="ghost" @click="budgetModalOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <label>
              <span>目标支出</span>
              <input v-model.number="budgetAmount" type="number" min="0" />
            </label>
            <div class="budget-meta">
              <span>本月支出：¥{{ formatAmount(budget.expenseAmount) }}</span>
              <span>结余：¥{{ formatAmount(budget.balance) }}</span>
            </div>
            <div class="budget-logs">
              <div class="budget-logs-title">本月修改记录（{{ budgetLogs.length }} 次）</div>
              <div v-if="!budgetLogs.length" class="muted">暂无修改记录</div>
              <div v-else class="budget-log-list">
                <div v-for="(log, idx) in budgetLogs" :key="idx" class="budget-log-row">
                  <span>{{ log.created_at }}</span>
                  <strong>¥{{ formatAmount(log.amount) }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="budgetModalOpen = false">取消</button>
            <button class="primary" @click="saveBudget">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="backdrop-fade">
      <div v-if="familyOverviewOpen" class="modal-backdrop" @click.self="familyOverviewOpen = false">
        <div class="modal family-modal">
          <div class="modal-head">
            <h3>家庭概览</h3>
            <button class="ghost" @click="familyOverviewOpen = false">关闭</button>
          </div>

          <div class="family-tabs">
            <button class="chip" :class="familyTab === 'category' && 'active'" @click="familyTab = 'category'">
              分类占比
            </button>
            <button class="chip" :class="familyTab === 'expense' && 'active'" @click="familyTab = 'expense'">
              支出对比
            </button>
            <button class="chip" :class="familyTab === 'income' && 'active'" @click="familyTab = 'income'">
              收入对比
            </button>
          </div>

          <div v-if="familyTab === 'expense'" class="family-tab-panel">
            <MemberSpendCompare
              v-model="compareMonth"
              :members="familyMembers"
              :records="familySummaryRecords"
              :summary="familySummary"
              :current-name="currentMemberName"
              mode="expense"
              title="家庭成员月度支出对比"
              subtitle="先个人后家庭"
            />
          </div>

          <div v-else-if="familyTab === 'income'" class="family-tab-panel">
            <MemberSpendCompare
              v-model="compareMonth"
              :members="familyMembers"
              :records="familySummaryRecords"
              :summary="familySummary"
              :current-name="currentMemberName"
              mode="income"
              title="家庭成员月度收入对比"
              subtitle="先个人后家庭"
            />
          </div>

          <div v-else class="family-tab-panel">
            <div class="family-category">
              <div class="family-category-head">{{ compareMonth }} · 家庭支出分类</div>
              <div class="family-category-summary">支出总额 ¥ {{ formatAmount(totalExpense) }}</div>
              <div class="family-category-body">
                <div class="family-waffle-stack">
                  <div class="family-waffle-wrap">
                    <WaffleGrid
                      :tiles="familyWaffle.tiles"
                      :legend="familyWaffle.legend"
                      :amount-formatter="formatAmount"
                      :size="160"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ledger-content {
  gap: 20px;
}

.ledger-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-card.clickable {
  cursor: pointer;
}

.stat-card.clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.ledger-actions .icon-only {
  width: 32px;
  height: 32px;
  padding: 0;
}

.ledger-actions .icon-only .iconify {
  width: 16px;
  height: 16px;
}

.ledger-cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ledger-cat-icon {
  width: 14px;
  height: 14px;
  color: color-mix(in srgb, var(--text) 75%, transparent);
}

.alloc-source {
  margin-top: 4px;
  color: var(--text-muted);
}

.alloc-lines {
  display: grid;
  gap: 6px;
}

.alloc-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.alloc-line.self {
  color: var(--text-muted);
}

.alloc-amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.alloc-editor {
  margin-top: 4px;
  padding: 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
  display: grid;
  gap: 10px;
}

.alloc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.alloc-head-title {
  font-weight: 700;
  font-size: 13px;
}

.alloc-detail-head {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}

.alloc-detail-title {
  font-weight: 700;
  font-size: 14px;
}

.budget-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.budget-logs {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.budget-logs-title {
  font-size: 12px;
  font-weight: 600;
}

.budget-log-list {
  display: grid;
  gap: 6px;
}

.budget-log-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text);
}

.alloc-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.alloc-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
}

.alloc-rows {
  display: grid;
  gap: 8px;
}

.alloc-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px auto;
  gap: 8px;
  align-items: center;
}

.alloc-amt {
  height: 34px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: var(--surface);
  color: var(--text);
  padding: 0 10px;
}


@media (max-width: 640px) {
  .alloc-row {
    grid-template-columns: 1fr;
  }
}

.family-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.family-tabs .chip {
  height: 26px;
  padding: 4px 10px;
  font-size: 11px;
}

.family-modal {
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.family-tab-panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.family-category-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.ledger-stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.task-tools {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 0.75fr) minmax(0, 1.2fr) minmax(0, 1fr);
  grid-template-areas: "date type search category";
  gap: 10px;
  align-items: center;
}

.task-tools .task-date {
  grid-area: date;
}

.task-tools .task-type {
  grid-area: type;
}

.task-tools .task-search {
  grid-area: search;
}

.task-tools .task-category {
  grid-area: category;
}

.task-tools .search,
.task-tools select {
  width: 100%;
}

.task-tools select {
  height: 32px;
}

:deep(.task-category .cat-trigger) {
  height: 32px;
  padding: 0 8px;
}

:deep(.task-category .cat-label) {
  font-size: 12px;
}


.ledger-date {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.ledger-date .date-label {
  font-size: 12px;
  color: var(--text-muted);
}

.ledger-date .date-input {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
}


.ledger-stat-grid .stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ledger-stat-grid .stat-card strong {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.ledger-chart {
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: var(--card-pad);
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}

.chart-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chart-summary h3 {
  margin: 4px 0 0;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}

.chart-grid-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 14px;
  align-items: start;
}


.chart-grid {
  position: relative;
}

.grid-tile {
  cursor: pointer;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 6px;
  font-size: 20px;
  font-weight: 600;
  color: color-mix(in srgb, var(--text) 85%, transparent);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  border-radius: 8px;
  pointer-events: auto;
  text-align: center;
  z-index: 1;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
}

.grid-overlay .overlay-name {
  font-size: 16px;
  letter-spacing: 0.6px;
}

.grid-overlay .overlay-percent {
  font-size: 26px;
}

:global([data-theme='dark']) .ledger-chart .grid-tile {
  filter: brightness(1.2) saturate(1.1);
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}

.grid-tile {
  width: 100%;
  padding-bottom: 100%;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--surface) 30%, transparent);
}

.chart-legend {
  display: grid;
  gap: 8px;
}

.legend-row {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text);
}

.legend-row .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-name {
  color: var(--text);
  font-size: 14px;
}

.family-waffle {
  position: relative;
}

.family-waffle .waffle-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 600;
  color: color-mix(in srgb, var(--text) 85%, transparent);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  border-radius: 8px;
  text-align: center;
  z-index: 1;
}

.family-waffle .waffle-overlay .overlay-name {
  font-size: 16px;
}

.family-waffle .waffle-overlay .overlay-percent {
  font-size: 26px;
}

.family-waffle-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.family-waffle-item {
  cursor: pointer;
}

.family-waffle-legend .name {
  font-size: 14px;
}

@media (max-width: 720px) {
  .family-waffle-legend {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .family-waffle-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.legend-amount {
  justify-self: end;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.rose-empty {
  padding: 18px;
  text-align: center;
  color: var(--text-muted);
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px dashed color-mix(in srgb, var(--border) 60%, transparent);
}

@media (max-width: 1024px) {
  .ledger-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ledger-chart {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .ledger-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .ledger-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ledger-actions {
    width: 100%;
  }
  .ledger-actions button {
    flex: 1 1 140px;
  }
  .task-tools {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
    grid-template-areas:
      "date type"
      "search category";
    gap: 8px;
  }
  .ledger-list-head {
    align-items: flex-start;
  }
  .ledger-date {
    width: 100%;
    justify-content: space-between;
  }
  .ledger-chart {
    grid-template-columns: 1fr;
  }
  .chart-grid-wrap {
    grid-template-columns: 1fr;
  }
  .chart-legend {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid-tooltip {
    justify-self: start;
  }
}
</style>
