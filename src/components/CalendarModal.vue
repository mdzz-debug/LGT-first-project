<script setup lang="ts">
import { computed, shallowRef, watchEffect } from 'vue'

export type CalendarEvent = {
  date: string
  title: string
  time?: string
  status?: 'todo' | 'done' | 'overdue'
  sourceType?: 'task' | 'habit'
  startAt?: string
  endAt?: string
}

const props = defineProps<{
  open: boolean
  events: CalendarEvent[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const monthCursor = shallowRef(new Date())
const selectedDate = shallowRef('')

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const todayKey = (() => {
  const now = new Date()
  return toLocalDateKey(now)
})()

const year = computed(() => monthCursor.value.getFullYear())
const month = computed(() => monthCursor.value.getMonth())

const startDay = computed(() => new Date(year.value, month.value, 1).getDay())
const daysInMonth = computed(() => new Date(year.value, month.value + 1, 0).getDate())

const monthLabel = computed(() => `${year.value}年 ${month.value + 1}月`)

const calendarCells = computed(() => {
  const cells: Array<{ key: string; date: string | null; label: number | null }> = []
  for (let i = 0; i < startDay.value; i += 1) {
    cells.push({ key: `empty-${i}`, date: null, label: null })
  }
  for (let day = 1; day <= daysInMonth.value; day += 1) {
    const date = new Date(year.value, month.value, day)
    const key = toLocalDateKey(date)
    cells.push({ key, date: key, label: day })
  }
  return cells
})

const formatTimeLabel = (event: CalendarEvent) => {
  const start = event.startAt ? event.startAt.replace('T', ' ') : ''
  const end = event.endAt ? event.endAt.replace('T', ' ') : ''
  if (start && end) {
    const sameDay = start.slice(0, 10) === end.slice(0, 10)
    if (sameDay) {
      return `${start.slice(11, 16)} - ${end.slice(11, 16)}`
    }
    return start.slice(11, 16)
  }
  if (start) return start.slice(11, 16)
  if (event.time) return event.time
  return '全天'
}

const formatRangeDayLabel = (event: CalendarEvent, dateKey: string) => {
  const start = event.startAt ? event.startAt.replace('T', ' ') : ''
  const end = event.endAt ? event.endAt.replace('T', ' ') : ''
  if (!start || !end) {
    return formatTimeLabel(event)
  }
  const startDate = start.slice(0, 10)
  const endDate = end.slice(0, 10)
  if (startDate === endDate) {
    return formatTimeLabel(event)
  }
  if (dateKey === startDate) {
    return `${start.slice(11, 16)} 起`
  }
  if (dateKey === endDate) {
    return `${end.slice(11, 16)} 止`
  }
  return '持续中'
}

const isCrossDay = (event: CalendarEvent) => {
  if (!event.startAt || !event.endAt) return false
  return event.startAt.slice(0, 10) !== event.endAt.slice(0, 10)
}

const formatRangeText = (event: CalendarEvent) => {
  if (!event.startAt || !event.endAt) return ''
  const start = event.startAt.replace('T', ' ')
  const end = event.endAt.replace('T', ' ')
  return `${start.slice(5, 10)} ~ ${end.slice(5, 10)}`
}

const eventsByDate = computed(() => {
  const map = new Map<string, Array<CalendarEvent & { timeLabel: string; sortKey: number }>>()

  const pushEvent = (dateKey: string, event: CalendarEvent) => {
    const start = event.startAt ? event.startAt.replace('T', ' ') : ''
    const end = event.endAt ? event.endAt.replace('T', ' ') : ''
    let sortKey = 9999
    if (start && dateKey === start.slice(0, 10)) {
      sortKey = Number(start.slice(11, 16).replace(':', ''))
    } else if (end && dateKey === end.slice(0, 10)) {
      sortKey = Number(end.slice(11, 16).replace(':', ''))
    }

    const list = map.get(dateKey) ?? []
    list.push({ ...event, timeLabel: formatRangeDayLabel(event, dateKey), sortKey })
    map.set(dateKey, list)
  }

  props.events.forEach((event) => {
    const startDate = event.startAt ? event.startAt.slice(0, 10) : event.date
    const endDate = event.endAt ? event.endAt.slice(0, 10) : startDate

    if (startDate && endDate && startDate !== endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10)
        pushEvent(key, event)
      }
      return
    }

    if (startDate) {
      pushEvent(startDate, event)
    }
  })

  map.forEach((list, key) => {
    map.set(
      key,
      list.sort((a, b) => a.sortKey - b.sortKey)
    )
  })

  return map
})


const selectedEvents = computed(() => {
  if (!selectedDate.value) return []
  return eventsByDate.value.get(selectedDate.value) ?? []
})

const getStatusLabel = (status?: CalendarEvent['status']) => {
  if (status === 'done') return '✓'
  if (status === 'overdue') return '逾期'
  return '待办'
}

const getDateStatus = (date: string) => {
  const events = eventsByDate.value.get(date) ?? []
  if (!events.length) return null
  const order = { overdue: 3, todo: 2, done: 1 } as const
  return events.reduce<CalendarEvent['status']>((best, item) => {
    const current = item.status ?? 'todo'
    const bestValue = best ?? 'todo'
    return order[current] > order[bestValue] ? current : bestValue
  }, 'todo')
}

const selectDate = (date: string) => {
  selectedDate.value = date
}

const prevMonth = () => {
  monthCursor.value = new Date(year.value, month.value - 1, 1)
}

const nextMonth = () => {
  monthCursor.value = new Date(year.value, month.value + 1, 1)
}

watchEffect(() => {
  if (!props.open) return
  if (!selectedDate.value) {
    selectedDate.value = todayKey
    return
  }
  const inMonth = selectedDate.value.startsWith(`${year.value}-${String(month.value + 1).padStart(2, '0')}`)
  if (!inMonth) {
    selectedDate.value = `${year.value}-${String(month.value + 1).padStart(2, '0')}-01`
  }
})
</script>

<template>
  <Transition name="backdrop-fade">
    <div v-if="open" class="modal-backdrop calendar-backdrop" @click.self="emit('close')">
      <div class="modal calendar-modal">
        <div class="calendar-head">
          <div>
            <h3>待办日历</h3>
            <p class="muted">点击日期查看当天安排</p>
          </div>
          <button class="ghost task-pill" @click="emit('close')">关闭</button>
        </div>

        <div class="calendar-controls">
          <button class="ghost task-pill" @click="prevMonth">上月</button>
          <div class="calendar-title">{{ monthLabel }}</div>
          <button class="ghost task-pill" @click="nextMonth">下月</button>
        </div>

        <div class="calendar-week">
          <span>日</span>
          <span>一</span>
          <span>二</span>
          <span>三</span>
          <span>四</span>
          <span>五</span>
          <span>六</span>
        </div>

        <div class="calendar-grid">
          <template v-for="cell in calendarCells" :key="cell.key">
            <button
              v-if="cell.date"
              class="calendar-cell"
              :class="{
                today: cell.date === todayKey,
                selected: cell.date === selectedDate,
                hasEvents: eventsByDate.get(cell.date)?.length
              }"
              @click="selectDate(cell.date)"
            >
              <span>{{ cell.label }}</span>
              <i
                v-if="eventsByDate.get(cell.date)?.length"
                class="status-dot"
                :class="`status-${getDateStatus(cell.date) ?? 'todo'}`"
              ></i>
            </button>
            <span v-else class="calendar-cell empty"></span>
          </template>
        </div>

        <div class="calendar-events">
          <div class="calendar-events-head">{{ selectedDate || '请选择日期' }}</div>
          <div v-if="selectedEvents.length" class="calendar-events-list">
            <div v-for="event in selectedEvents" :key="event.title" class="calendar-event">
              <span class="calendar-event-time">{{ event.timeLabel ?? '全天' }}</span>
              <div class="calendar-event-body">
                <div class="calendar-event-title">{{ event.title }}</div>
                <div class="calendar-event-meta">
                  <span v-if="event.sourceType" class="source-pill" :class="`source-${event.sourceType}`">
                    {{ event.sourceType === 'task' ? '任务' : '习惯' }}
                  </span>
                  <span class="status-pill" :class="`status-${event.status ?? 'todo'}`">
                    {{ getStatusLabel(event.status) }}
                  </span>
                </div>
                <div v-if="isCrossDay(event)" class="range-strip">
                  <div class="range-text">跨日：{{ formatRangeText(event) }}</div>
                  <div class="range-line" :class="`status-${event.status ?? 'todo'}`"></div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">暂无安排</div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.status-pill.status-done {
  color: var(--success-text);
  background: var(--success-bg);
  border: 1px solid var(--success-border);
}

.calendar-event {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 10px;
  font-size: 13px;
  align-items: start;
}

.calendar-event-time {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.calendar-event-body {
  display: grid;
  gap: 6px;
}

.calendar-event-title {
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-cell span,
.calendar-cell .status-dot {
  position: relative;
  z-index: 1;
}

.calendar-event-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.source-pill {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  line-height: 1;
  background: rgba(255, 255, 255, 0.06);
}

.source-task {
  border-color: rgba(99, 102, 241, 0.45);
  color: rgba(165, 180, 252, 0.95);
}

.source-habit {
  border-color: rgba(34, 197, 94, 0.45);
  color: rgba(134, 239, 172, 0.95);
}

.range-strip {
  display: grid;
  gap: 6px;
  margin-top: 2px;
}

.range-text {
  font-size: 12px;
  color: var(--text-muted);
}

.range-line {
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 35%, transparent);
}

.range-line.status-done {
  background: color-mix(in srgb, var(--success) 45%, transparent);
}

.range-line.status-overdue {
  background: color-mix(in srgb, var(--danger) 45%, transparent);
}

.range-line.status-todo {
  background: color-mix(in srgb, var(--primary) 45%, transparent);
}

.range-fill {
  position: absolute;
  inset: 6px 4px 6px 4px;
  border-radius: 10px;
  z-index: 0;
  background: color-mix(in srgb, var(--range-color) 18%, transparent);
}

.range-fill::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--range-color);
  transform: translateY(-50%);
  opacity: 0.85;
}

.range-fill.range-start {
  border-radius: 10px 4px 4px 10px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--range-color) 22%, transparent) 0%, color-mix(in srgb, var(--range-color) 16%, transparent) 70%, transparent 100%);
}

.range-fill.range-start::after {
  left: 6px;
}

.range-fill.range-mid {
  border-radius: 4px;
  background: color-mix(in srgb, var(--range-color) 16%, transparent);
}

.range-fill.range-mid::after {
  display: none;
}

.range-fill.range-end {
  border-radius: 4px 10px 10px 4px;
  background: linear-gradient(270deg, color-mix(in srgb, var(--range-color) 22%, transparent) 0%, color-mix(in srgb, var(--range-color) 16%, transparent) 70%, transparent 100%);
}

.range-fill.range-end::after {
  right: 6px;
}

.range-fill.status-done {
  --range-color: color-mix(in srgb, var(--success) 70%, transparent);
}

.range-fill.status-overdue {
  --range-color: color-mix(in srgb, var(--danger) 70%, transparent);
}

.range-fill.status-todo {
  --range-color: color-mix(in srgb, var(--primary) 70%, transparent);
}
</style>
