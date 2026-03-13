<script setup lang="ts">
import { computed, ref, shallowRef, onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MemberSpendCompare from '../components/MemberSpendCompare.vue'

const categories = ['餐饮', '交通', '居家', '教育', '娱乐', '其他']
const types = ['expense', 'income'] as const

type LedgerType = (typeof types)[number]

type LedgerMember = {
  id: string
  name: string
  avatar: string
}

type LedgerRecord = {
  id: string
  type: LedgerType
  category: string
  amount: number
  date: string
  note: string
  memberId: string
}

const members = ref<LedgerMember[]>([
  { id: 'm1', name: '罗董', avatar: '/avatars/avatar-1.svg' },
  { id: 'm2', name: '小李', avatar: '/avatars/avatar-2.svg' }
])

const compareMonth = shallowRef(new Date().toISOString().slice(0, 7))

const getDefaultMemberId = () => members.value[0]?.id ?? 'm1'
const currentMemberId = shallowRef(getDefaultMemberId())
const currentMember = computed(
  () => members.value.find((member) => member.id === currentMemberId.value) ?? members.value[0]
)

const records = ref<LedgerRecord[]>([
  {
    id: 'l1',
    type: 'expense',
    category: '餐饮',
    amount: 68,
    date: '2026-03-13',
    note: '午餐',
    memberId: 'm1'
  },
  {
    id: 'l2',
    type: 'expense',
    category: '交通',
    amount: 22,
    date: '2026-03-13',
    note: '打车',
    memberId: 'm1'
  },
  {
    id: 'l3',
    type: 'income',
    category: '其他',
    amount: 1200,
    date: '2026-03-12',
    note: '项目结算',
    memberId: 'm2'
  },
  {
    id: 'l4',
    type: 'expense',
    category: '居家',
    amount: 199,
    date: '2026-03-12',
    note: '日用品',
    memberId: 'm2'
  }
])

const query = ref('')
const filterType = ref<'all' | 'expense' | 'income'>('all')
const filterCategory = ref('all')

const modalOpen = ref(false)
const familyOverviewOpen = ref(false)
const familyTab = ref<'expense' | 'income' | 'category'>('expense')
const editingId = ref<string | null>(null)
const form = ref<Omit<LedgerRecord, 'id'>>({
  type: 'expense',
  category: categories[0] ?? '餐饮',
  amount: 0,
  date: '2026-03-13',
  note: '',
  memberId: currentMemberId.value
})

const memberRecords = computed(() =>
  records.value.filter((item) => item.memberId === currentMemberId.value)
)

const filtered = computed(() => {
  return memberRecords.value.filter((item) => {
    const hitQuery = item.note.includes(query.value.trim())
    const hitType = filterType.value === 'all' || item.type === filterType.value
    const hitCategory = filterCategory.value === 'all' || item.category === filterCategory.value
    return hitQuery && hitType && hitCategory
  })
})

const totalIncome = computed(() =>
  memberRecords.value.filter((r) => r.type === 'income').reduce((sum, r) => sum + r.amount, 0)
)
const totalExpense = computed(() =>
  memberRecords.value.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0)
)
const balance = computed(() => totalIncome.value - totalExpense.value)

const familyMonthRecords = computed(() =>
  records.value.filter((item) => item.date.startsWith(compareMonth.value))
)

const familyCategoryTotals = computed(() => {
  const totals = categories.map((cat) => {
    const total = familyMonthRecords.value
      .filter((item) => item.type === 'expense')
      .filter((item) => item.category === cat)
      .reduce((sum, item) => sum + item.amount, 0)
    return { category: cat, total }
  })
  const max = Math.max(1, ...totals.map((row) => row.total))
  return totals.map((row) => ({
    ...row,
    percent: Math.round((row.total / max) * 100)
  }))
})

const donutStyle = computed(() => {
  const expenses = memberRecords.value.filter((r) => r.type === 'expense')
  const total = expenses.reduce((sum, r) => sum + r.amount, 0) || 1
  const palette = ['#6366f1', '#38bdf8', '#f97316', '#10b981', '#f43f5e', '#a78bfa']
  let start = 0
  const slices = categories.map((cat, idx) => {
    const value = expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
    const pct = (value / total) * 100
    const end = start + pct
    const seg = `${palette[idx % palette.length]} ${start}% ${end}%`
    start = end
    return seg
  })
  return { background: `conic-gradient(${slices.join(',')})` }
})

const openFamilyOverview = () => {
  familyOverviewOpen.value = true
}

onMounted(() => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('family') === '1') {
    familyOverviewOpen.value = true
  }
})

const openCreate = () => {
  editingId.value = null
  form.value = {
    type: 'expense',
    category: categories[0] ?? '餐饮',
    amount: 0,
    date: '2026-03-13',
    note: '',
    memberId: currentMemberId.value
  }
  modalOpen.value = true
}

const openEdit = (item: LedgerRecord) => {
  editingId.value = item.id
  const { id, ...rest } = item
  form.value = { ...rest }
  modalOpen.value = true
}

const saveRecord = () => {
  if (!form.value.note.trim()) return
  const payload = {
    ...form.value,
    // 明细只允许写入当前登录成员
    memberId: currentMemberId.value
  }
  if (editingId.value) {
    records.value = records.value.map((item) =>
      item.id === editingId.value ? { ...item, ...payload } : item
    )
  } else {
    records.value.unshift({ id: `l${Date.now()}`, ...payload })
  }
  modalOpen.value = false
}

const removeRecord = (id: string) => {
  records.value = records.value.filter((r) => r.id !== id)
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="section-title">
          <h2>记账板块</h2>
          <div class="header-actions">
            <button class="ghost task-pill header-pill" @click="openFamilyOverview">家庭概览</button>
            <button class="primary header-pill" @click="openCreate">新增记录</button>
          </div>
        </div>

        <p class="muted">当前成员：{{ currentMember?.name ?? '未知' }}</p>

        <div class="ledger-summary">
          <div class="summary-card income">
            <p class="muted">收入</p>
            <h3>¥ {{ totalIncome }}</h3>
          </div>
          <div class="summary-card expense">
            <p class="muted">支出</p>
            <h3>¥ {{ totalExpense }}</h3>
          </div>
          <div class="summary-card balance">
            <p class="muted">结余</p>
            <h3>¥ {{ balance }}</h3>
          </div>
          <div class="summary-chart">
            <div class="donut" :style="donutStyle"></div>
            <div class="legend">
              <div v-for="cat in categories" :key="cat" class="legend-item">
                <span class="dot"></span>
                <span>{{ cat }}</span>
              </div>
            </div>
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

        <div class="ledger-list">
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
              <button class="ghost task-pill danger" @click="removeRecord(item.id)">删除</button>
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
            <button class="chip" :class="familyTab === 'expense' && 'active'" @click="familyTab = 'expense'">
              支出对比
            </button>
            <button class="chip" :class="familyTab === 'income' && 'active'" @click="familyTab = 'income'">
              收入对比
            </button>
            <button class="chip" :class="familyTab === 'category' && 'active'" @click="familyTab = 'category'">
              分类占比
            </button>
          </div>

          <div v-if="familyTab === 'expense'" class="family-tab-panel">
            <MemberSpendCompare
              v-model="compareMonth"
              :members="members"
              :records="records"
              mode="expense"
              title="家庭成员月度支出对比"
              subtitle="全体成员汇总"
            />
          </div>

          <div v-else-if="familyTab === 'income'" class="family-tab-panel">
            <MemberSpendCompare
              v-model="compareMonth"
              :members="members"
              :records="records"
              mode="income"
              title="家庭成员月度收入对比"
              subtitle="全体成员汇总"
            />
          </div>

          <div v-else class="family-tab-panel">
            <div class="family-category">
              <div class="family-category-head">{{ compareMonth }} · 家庭支出分类</div>
              <div class="family-category-list">
                <div v-for="item in familyCategoryTotals" :key="item.category" class="family-category-item">
                  <div class="family-category-name">{{ item.category }}</div>
                  <div class="family-category-bar">
                    <div class="family-category-fill" :style="{ width: item.percent + '%' }"></div>
                  </div>
                  <div class="family-category-value">¥ {{ item.total }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
