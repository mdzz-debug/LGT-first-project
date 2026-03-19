<script setup lang="ts">
import { computed } from 'vue'
import WaffleGrid from './WaffleGrid.vue'
import { buildWaffle } from '../utils/waffle'

type Member = {
  id: string | number
  name: string
  avatar?: string | null
}

type Record = {
  memberId?: string | number
  type: 'expense' | 'income'
  amount: number
  date: string
}

type SummaryMember = Member & {
  expense?: number
  income?: number
}

type Summary = {
  expenseTotal?: number
  incomeTotal?: number
  members?: SummaryMember[]
}

const monthModel = defineModel<string>({ required: true })

const props = defineProps<{
  members?: Member[]
  records?: Record[]
  mode?: 'expense' | 'income'
  title?: string
  subtitle?: string
  summary?: Summary | null
  currentName?: string
}>()

const parseMonth = (value: string): { year: number; month: number } => {
  const [y, m] = value.split('-')
  const now = new Date()
  const year = Number(y) || now.getFullYear()
  const month = Number(m) || now.getMonth() + 1
  return { year, month }
}

const formatMonth = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const monthLabel = computed(() => {
  const { year, month } = parseMonth(monthModel.value)
  return `${year}年 ${String(month).padStart(2, '0')}月`
})

const mode = computed(() => props.mode ?? 'expense')

const summaryMembers = computed(() => props.summary?.members ?? [])
const propMembers = computed(() => props.members ?? [])

const monthRecords = computed(() =>
  (props.records ?? []).filter((item) => item.date.startsWith(monthModel.value))
)

const useSummary = computed(() => summaryMembers.value.length > 0)

const familyTotal = computed(() => {
  if (useSummary.value) {
    if (mode.value === 'expense') {
      if (typeof props.summary?.expenseTotal === 'number') {
        return props.summary.expenseTotal
      }
      return summaryMembers.value.reduce((sum, item) => sum + Number(item.expense ?? 0), 0)
    }
    if (typeof props.summary?.incomeTotal === 'number') {
      return props.summary.incomeTotal
    }
    return summaryMembers.value.reduce((sum, item) => sum + Number(item.income ?? 0), 0)
  }
  return monthRecords.value
    .filter((item) => item.type === mode.value)
    .reduce((sum, item) => sum + item.amount, 0)
})

const memberRows = computed(() => {
  const currentName = props.currentName

  const sortRows = <T extends { name?: string; total?: number }>(rows: T[]) => {
    if (!currentName) return rows.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    return [...rows].sort((a, b) => {
      if (a.name === currentName) return -1
      if (b.name === currentName) return 1
      return (b.total ?? 0) - (a.total ?? 0)
    })
  }

  if (useSummary.value) {
    const rows = summaryMembers.value.map((member) => {
      const total = mode.value === 'expense'
        ? Number(member.expense ?? 0)
        : Number(member.income ?? 0)
      return { ...member, total }
    })
    return sortRows(rows)
  }

  const rows = propMembers.value.map((member) => {
    const total = monthRecords.value
      .filter((item) => item.memberId === member.id)
      .filter((item) => item.type === mode.value)
      .reduce((sum, item) => sum + item.amount, 0)
    return { ...member, total }
  })
  return sortRows(rows)
})

const memberWaffle = computed(() =>
  buildWaffle(
    memberRows.value.map((row, idx) => ({
      label: row.name ?? '成员',
      amount: Number(row.total ?? 0),
      color: `hsl(${(idx * 55) % 360} 80% 55%)`
    }))
  )
)

const formatAmount = (value: number) => value.toFixed(2)

const prevMonth = () => {
  const { year, month } = parseMonth(monthModel.value)
  const nextMonth = month - 1 <= 0 ? 12 : month - 1
  const nextYear = month - 1 <= 0 ? year - 1 : year
  monthModel.value = formatMonth(nextYear, nextMonth)
}

const nextMonth = () => {
  const { year, month } = parseMonth(monthModel.value)
  const nextMonth = month + 1 > 12 ? 1 : month + 1
  const nextYear = month + 1 > 12 ? year + 1 : year
  monthModel.value = formatMonth(nextYear, nextMonth)
}
</script>

<template>
  <section class="member-compare">
    <div class="member-compare-head">
      <div>
        <h3>{{ props.title ?? '家庭成员月度消费对比' }}</h3>
        <p class="muted">{{ props.subtitle ?? '仅统计支出，按成员汇总' }}</p>
      </div>
      <div class="member-compare-month">
        <button class="ghost task-pill month-button" @click="prevMonth">上月</button>
        <Transition name="month-slide" mode="out-in">
          <span :key="monthLabel" class="month-pill">{{ monthLabel }}</span>
        </Transition>
        <button class="ghost task-pill month-button" @click="nextMonth">下月</button>
      </div>
    </div>

    <div class="member-compare-summary">家庭总{{ mode === 'expense' ? '支出' : '收入' }}：¥ {{ familyTotal }}</div>

    <div class="member-compare-grid">
      <WaffleGrid
        :tiles="memberWaffle.tiles"
        :legend="memberWaffle.legend"
        :amount-formatter="formatAmount"
        size="min(100%, 320px)"
        :show-legend="false"
      />
      <div class="member-compare-list">
        <div
          v-for="item in memberWaffle.legend"
          :key="item.label"
          class="member-compare-item"
        >
          <span class="member-compare-dot" :style="{ background: item.color }"></span>
          <span class="member-compare-name">{{ item.label }}</span>
          <span class="member-compare-amount">¥ {{ formatAmount(item.amount) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.member-compare {
  display: grid;
  gap: 14px;
}

.member-compare-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.member-compare-head h3 {
  margin: 0;
}

.member-compare-month {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.month-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 104px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  font-weight: 600;
}

.month-button {
  min-width: 72px;
}

.member-compare-summary {
  font-weight: 600;
}

.member-compare-grid {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(220px, 1fr);
  gap: 20px;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.member-compare-grid :deep(.waffle-grid-wrap) {
  width: 320px;
}

.member-compare-list {
  display: grid;
  gap: 10px;
  align-content: start;
}

.member-compare-item {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.member-compare-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.member-compare-name {
  min-width: 0;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-compare-amount {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .member-compare-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .member-compare-grid :deep(.waffle-grid-wrap) {
    width: 100%;
  }

  .member-compare-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
  }

  .month-pill {
    min-width: 92px;
  }
}
</style>
