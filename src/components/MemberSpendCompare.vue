<script setup lang="ts">
import { computed, shallowRef } from 'vue'

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

const memberWaffle = computed(() => {
  const rows = memberRows.value
  if (!rows.length) return { tiles: [], legend: [] }
  const total = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0)
  if (!total) {
    const legend = rows.map((r, idx) => ({
      ...r,
      color: `hsl(${(idx * 55) % 360} 80% 55%)`,
      percent: 0
    }))
    const tiles = Array.from({ length: 100 }, () => ({ name: '', color: 'transparent' }))
    return { tiles, legend }
  }

  const legend = rows.map((r, idx) => ({
    ...r,
    color: `hsl(${(idx * 55) % 360} 80% 55%)`,
    percent: Math.round((Number(r.total ?? 0) / total) * 100)
  }))

  const counts = legend.map((item) => ({
    ...item,
    count: Math.round((Number(item.total ?? 0) / total) * 100)
  }))
  let allocated = counts.reduce((sum, item) => sum + item.count, 0)
  if (allocated !== 100 && counts.length) {
    const diff = 100 - allocated
    const first = counts[0]
    if (first) {
      first.count = Math.max(0, first.count + diff)
    }
  }

  const tiles: Array<{ name: string; color: string }> = []
  counts.forEach((item) => {
    for (let i = 0; i < item.count; i += 1) {
      tiles.push({ name: item.name ?? '', color: item.color })
    }
  })

  return { tiles, legend }
})

const waffleActive = shallowRef<string | null>(null)
const waffleActiveInfo = computed(() =>
  memberWaffle.value.legend.find((item) => item.name === waffleActive.value) || null
)
const toggleWaffleActive = (name: string) => {
  waffleActive.value = waffleActive.value === name ? null : name
}

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
      <div class="member-compare-waffle-grid">
        <div
          v-for="(tile, idx) in memberWaffle.tiles"
          :key="idx"
          class="member-waffle-tile"
          :style="{ background: tile.color }"
          :title="tile.name"
          @click="toggleWaffleActive(tile.name)"
        ></div>
        <div v-if="waffleActiveInfo" class="waffle-overlay" @click="waffleActive = null">
          <span class="overlay-name">{{ waffleActiveInfo.name }}</span>
          <span class="overlay-percent">{{ waffleActiveInfo.percent }}%</span>
        </div>
      </div>
      <div class="member-compare-legend">
        <div v-for="item in memberWaffle.legend" :key="item.id" class="member-legend-item" @click="toggleWaffleActive(item.name)">
          <span class="dot" :style="{ background: item.color }"></span>
          <div class="legend-left">
            <span class="name">{{ item.name }}</span>
          </div>
          <span class="amount">¥ {{ item.total }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.member-compare-waffle-grid {
  position: relative;
}

.member-waffle-tile {
  cursor: pointer;
}

.waffle-overlay {
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

.waffle-overlay .overlay-name {
  font-size: 16px;
}

.waffle-overlay .overlay-percent {
  font-size: 24px;
}

.member-compare-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.member-compare-legend .name {
  font-size: 14px;
}
</style>
