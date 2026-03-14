<script setup lang="ts">
import { computed, shallowRef, watchEffect } from 'vue'

export type CalendarEvent = {
  date: string
  title: string
  time?: string
  status?: 'todo' | 'done' | 'overdue'
  sourceType?: 'task' | 'habit'
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

const todayKey = (() => {
  const now = new Date()
  return now.toISOString().slice(0, 10)
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
    const key = date.toISOString().slice(0, 10)
    cells.push({ key, date: key, label: day })
  }
  return cells
})

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  props.events.forEach((event) => {
    const list = map.get(event.date) ?? []
    list.push(event)
    map.set(event.date, list)
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
              <span class="calendar-event-time">{{ event.time ?? '全天' }}</span>
              <span class="calendar-event-title">{{ event.title }}</span>
              <span v-if="event.sourceType" class="source-pill" :class="`source-${event.sourceType}`">
                {{ event.sourceType === 'task' ? '任务' : '习惯' }}
              </span>
              <span class="status-pill" :class="`status-${event.status ?? 'todo'}`">
                {{ getStatusLabel(event.status) }}
              </span>
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

.calendar-event-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
