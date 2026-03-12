<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'

const categories = ['餐饮', '交通', '居家', '教育', '娱乐', '其他']
const types = ['expense', 'income'] as const

const records = ref([
  { id: 'l1', type: 'expense', category: '餐饮', amount: 68, date: '2026-03-13', note: '午餐' },
  { id: 'l2', type: 'expense', category: '交通', amount: 22, date: '2026-03-13', note: '打车' },
  { id: 'l3', type: 'income', category: '其他', amount: 1200, date: '2026-03-12', note: '项目结算' },
  { id: 'l4', type: 'expense', category: '居家', amount: 199, date: '2026-03-12', note: '日用品' }
])

const query = ref('')
const filterType = ref<'all' | 'expense' | 'income'>('all')
const filterCategory = ref('all')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  type: 'expense',
  category: categories[0],
  amount: 0,
  date: '2026-03-13',
  note: ''
})

const filtered = computed(() => {
  return records.value.filter((item) => {
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

const donutStyle = computed(() => {
  const expenses = records.value.filter((r) => r.type === 'expense')
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

const openCreate = () => {
  editingId.value = null
  form.value = { type: 'expense', category: categories[0], amount: 0, date: '2026-03-13', note: '' }
  modalOpen.value = true
}

const openEdit = (item: any) => {
  editingId.value = item.id
  form.value = { ...item }
  modalOpen.value = true
}

const saveRecord = () => {
  if (!form.value.note.trim()) return
  if (editingId.value) {
    records.value = records.value.map((item) =>
      item.id === editingId.value ? { ...item, ...form.value } : item
    )
  } else {
    records.value.unshift({ id: `l${Date.now()}`, ...form.value })
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
          <button class="primary" @click="openCreate">新增记录</button>
        </div>

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
              <button class="ghost small" @click="openEdit(item)">编辑</button>
              <button class="ghost danger" @click="removeRecord(item.id)">删除</button>
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
  </div>
</template>
