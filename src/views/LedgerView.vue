<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MemberSpendCompare from '../components/MemberSpendCompare.vue'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'
import { useRecycleFly } from '../composables/useRecycleFly'

const defaultCategories = ['餐饮', '交通', '居家', '教育', '娱乐', '其他']
const categories = ref<string[]>([...defaultCategories])
const types = ['expense', 'income'] as const

type LedgerType = (typeof types)[number]

type LedgerRecord = {
  id: string | number
  type: LedgerType
  category: string
  categoryId?: string | number
  amount: number
  date: string
  note: string
  memberId?: string | number
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
const selectedDate = shallowRef(new Date().toISOString().slice(0, 10))

const modalOpen = ref(false)
const familyOverviewOpen = ref(false)

const { flyToRecycle } = useRecycleFly()
const familyTab = ref<'expense' | 'income' | 'category'>('category')
const editingId = ref<string | number | null>(null)
const form = ref({
  type: 'expense' as LedgerType,
  category: categories.value[0] ?? '其他',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  note: ''
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
  records.value.filter((r) => r.type === 'income').reduce((sum, r) => sum + r.amount, 0)
)
const totalExpense = computed(() =>
  records.value.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0)
)
const balance = computed(() => totalIncome.value - totalExpense.value)

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
      color: chartPalette[idx % chartPalette.length]
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

const categoryGrid = computed(() => {
  const items = categoryChart.value
  if (!items.length) return { tiles: [], legend: [] }
  const total = items.reduce((sum, item) => sum + item.total, 0)
  if (!total) return { tiles: [], legend: [] }

  const legend = items.map((item) => ({
    ...item,
    percent: Math.round((item.total / total) * 100)
  }))

  const counts = legend.map((item) => ({
    ...item,
    count: Math.round((item.total / total) * 100)
  }))

  let allocated = counts.reduce((sum, item) => sum + item.count, 0)
  if (allocated !== 100 && counts.length) {
    const diff = 100 - allocated
    const first = counts[0]
    if (first) {
      first.count = Math.max(0, first.count + diff)
    }
  }

  const tiles: Array<{ category: string; color: string }> = []
  counts.forEach((item) => {
    for (let i = 0; i < item.count; i += 1) {
      tiles.push({ category: item.category, color: item.color || '#cbd5f5' })
    }
  })

  return { tiles, legend }
})

const gridActive = shallowRef<string | null>(null)
const gridActiveInfo = computed(() =>
  categoryGrid.value.legend.find((item) => item.category === gridActive.value) || null
)
const toggleGridActive = (category: string) => {
  gridActive.value = gridActive.value === category ? null : category
}

const familyWaffle = computed(() => {
  const rows = familyCategoryTotals.value.filter((r) => r.total > 0)
  if (!rows.length) return { tiles: [], legend: [] }
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  if (!total) return { tiles: [], legend: [] }

  const legend = rows.map((r, idx) => ({
    ...r,
    color: chartPalette[idx % chartPalette.length],
    percent: Math.round((r.total / total) * 100)
  }))

  const counts = legend.map((item) => ({
    ...item,
    count: Math.round((item.total / total) * 100)
  }))

  let allocated = counts.reduce((sum, item) => sum + item.count, 0)
  if (allocated !== 100) {
    const diff = 100 - allocated
    const first = counts[0]
    if (first) {
      first.count = Math.max(0, first.count + diff)
    }
  }

  const tiles: Array<{ category: string; color: string }> = []
  counts.forEach((item) => {
    for (let i = 0; i < item.count; i += 1) {
      tiles.push({ category: item.category ?? '其他', color: item.color ?? '#cbd5f5' })
    }
  })

  return { tiles, legend }
})

const familyGridActive = shallowRef<string | null>(null)
const familyGridActiveInfo = computed(() =>
  familyWaffle.value.legend.find((item) => item.category === familyGridActive.value) || null
)
const toggleFamilyGridActive = (category: string) => {
  familyGridActive.value = familyGridActive.value === category ? null : category
}

const fetchRecords = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await apiFetch<any[]>('/ledger/records')
    records.value = data.map((item) => ({
      id: item.id,
      type: item.type,
      category: item.category,
      categoryId: item.category_id ?? item.categoryId ?? item.categoryID,
      amount: Number(item.amount),
      date: item.date,
      note: item.note ?? '',
      memberId: item.member_id ?? item.memberId ?? 'self'
    }))
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

const fetchCategories = async () => {
  try {
    const data = await apiFetch<any[]>('/ledger/categories')
    const base = [...defaultCategories]
    if (Array.isArray(data) && data.length) {
      const names = data
        .map((item) => item.name ?? item.category ?? item)
        .filter((name: any) => typeof name === 'string' && name.trim())
      const extra = names.filter((name: string) => !base.includes(name))
      const merged = [...base, ...extra]
      if (!merged.includes('其他')) merged.push('其他')
      categories.value = Array.from(new Set(merged))
    } else {
      if (!base.includes('其他')) base.push('其他')
      categories.value = base
    }
  } catch {
    categories.value = [...defaultCategories]
    if (!categories.value.includes('其他')) categories.value.push('其他')
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
    date: new Date().toISOString().slice(0, 10),
    note: ''
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
    note: item.note
  }
  modalOpen.value = true
}

const saveRecord = async () => {
  if (!form.value.note.trim()) return
  try {
    if (editingId.value) {
      await apiFetch(`/ledger/records/${editingId.value}`, {
        method: 'PATCH',
        body: form.value
      })
      pushToast('记账已更新', 'success')
    } else {
      await apiFetch('/ledger/records', {
        method: 'POST',
        body: form.value
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
  await Promise.all([loadCurrentMember(), fetchCategories(), fetchRecords(), fetchFamilySummary()])
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
            <strong>¥ {{ formatAmount(totalExpense) }}</strong>
          </div>
          <div class="stat-card">
            <span>结余</span>
            <strong>¥ {{ formatAmount(balance) }}</strong>
          </div>
          <div class="stat-card">
            <span>记录数</span>
            <strong>{{ records.length }}</strong>
          </div>
        </div>

        <div v-if="categoryGrid.legend.length" class="ledger-chart grid-chart">
          <div class="chart-summary">
            <span class="kicker">支出分布</span>
            <h3>¥ {{ formatAmount(totalExpense) }}</h3>
            <p class="muted">本月支出总额</p>
          </div>
          <div class="chart-grid-wrap">
            <div class="chart-grid">
              <div
                v-for="(tile, idx) in categoryGrid.tiles"
                :key="idx"
                class="grid-tile"
                :style="{ background: tile.color }"
                :title="tile.category"
                @click="toggleGridActive(tile.category)"
              ></div>
              <div v-if="gridActiveInfo" class="grid-overlay" @click="gridActive = null">
                <span class="overlay-name">{{ gridActiveInfo.category }}</span>
                <span class="overlay-percent">{{ gridActiveInfo.percent }}%</span>
              </div>
            </div>
            <div class="chart-legend">
              <div v-for="item in categoryGrid.legend" :key="item.category" class="legend-row" @click="toggleGridActive(item.category)">
                <span class="dot" :style="{ background: item.color }"></span>
                <span class="legend-name">{{ item.category }}</span>
                <span class="legend-amount">¥ {{ formatAmount(item.total) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="rose-empty">暂无支出数据</div>
      </section>

      <section class="panel glass ledger-list-panel">
        <div class="task-board-head ledger-list-head">
          <div>
            <h3>记账记录</h3>
            <p class="muted">共 {{ dailyRecords.length }} 条</p>
          </div>
          <div class="ledger-date">
            <span class="date-label">日期</span>
            <input v-model="selectedDate" type="date" class="date-input" />
          </div>
        </div>

        <div class="task-tools">
          <div class="search">
            <input v-model="query" placeholder="搜索备注" />
          </div>
          <select v-model="filterType">
            <option value="all">全部</option>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <select v-model="filterCategory">
            <option value="all">全部分类</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div v-if="loading" class="empty-state">加载中…</div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>
        <div v-else-if="!filtered.length" class="empty-state">暂无当天记账记录</div>

        <div v-else class="ledger-list">
          <div v-for="item in filtered" :key="item.id" class="ledger-item">
            <div>
              <h4>{{ item.note }}</h4>
              <p class="muted">{{ item.category }} · {{ item.date }}</p>
            </div>
            <div class="ledger-amount" :class="item.type">
              {{ item.type === 'income' ? '+' : '-' }}¥{{ item.amount }}
            </div>
            <div class="ledger-actions">
              <button class="ghost task-pill" @click="openEdit(item)">编辑</button>
              <button class="ghost task-pill danger" @click="removeRecord(item.id, $event)">删除</button>
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
              <select v-model="form.category">
                <option v-for="cat in categories" :key="cat">{{ cat }}</option>
              </select>
            </label>
            <label>
              <span>金额</span>
              <input v-model.number="form.amount" type="number" min="0" />
            </label>
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
              <div class="family-category-body">
                <div class="family-waffle-stack">
                  <div class="family-waffle-wrap">
                    <div class="family-waffle">
                      <div
                        v-for="(tile, idx) in familyWaffle.tiles"
                        :key="idx"
                        class="waffle-tile"
                        :style="{ background: tile.color }"
                        :title="tile.category"
                        @click="toggleFamilyGridActive(tile.category)"
                      ></div>
                      <div v-if="familyGridActiveInfo" class="waffle-overlay" @click="familyGridActive = null">
                        <span class="overlay-name">{{ familyGridActiveInfo.category }}</span>
                        <span class="overlay-percent">{{ familyGridActiveInfo.percent }}%</span>
                      </div>
                    </div>
                  </div>
                  <div class="family-waffle-total">支出总额 ¥ {{ formatAmount(totalExpense) }}</div>
                </div>

                <div class="family-waffle-legend">
                  <div v-for="item in familyWaffle.legend" :key="item.category" class="family-waffle-item" @click="toggleFamilyGridActive(item.category)">
                    <span class="dot" :style="{ background: item.color }"></span>
                    <div class="legend-left">
                      <span class="name">{{ item.category }}</span>
                    </div>
                    <span class="amount">¥ {{ formatAmount(item.total) }}</span>
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

.ledger-stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.task-tools {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: center;
}

.task-tools .search,
.task-tools select {
  width: 100%;
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
  font-size: 20px;
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
  font-size: 20px;
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
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr);
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
