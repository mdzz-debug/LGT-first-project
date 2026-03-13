<script setup lang="ts">
import { computed } from 'vue'

type Member = {
  id: string
  name: string
  avatar?: string
}

type Record = {
  memberId: string
  type: 'expense' | 'income'
  amount: number
  date: string
}

const monthModel = defineModel<string>({ required: true })

const props = defineProps<{
  members: Member[]
  records: Record[]
  mode?: 'expense' | 'income'
  title?: string
  subtitle?: string
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

const monthRecords = computed(() =>
  props.records.filter((item) => item.date.startsWith(monthModel.value))
)

const familyTotal = computed(() =>
  monthRecords.value
    .filter((item) => item.type === mode.value)
    .reduce((sum, item) => sum + item.amount, 0)
)

const memberTotals = computed(() => {
  const rows = props.members.map((member) => {
    const total = monthRecords.value
      .filter((item) => item.memberId === member.id)
      .filter((item) => item.type === mode.value)
      .reduce((sum, item) => sum + item.amount, 0)
    return { ...member, total }
  })
  const max = Math.max(1, ...rows.map((row) => row.total))
  return rows.map((row) => ({
    ...row,
    percent: Math.round((row.total / max) * 100)
  }))
})

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

    <div class="member-compare-list">
      <div v-for="item in memberTotals" :key="item.id" class="member-compare-item">
        <div class="member-compare-name">
          <span class="member-avatar">
            <img v-if="item.avatar" :src="item.avatar" :alt="item.name" />
            <span v-else>{{ item.name.slice(0, 1) }}</span>
          </span>
          <span>{{ item.name }}</span>
        </div>
        <div class="member-compare-bar">
          <div class="member-compare-fill" :style="{ width: item.percent + '%' }"></div>
        </div>
        <div class="member-compare-value">¥ {{ item.total }}</div>
      </div>
    </div>
  </section>
</template>
