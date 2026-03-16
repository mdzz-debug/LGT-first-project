<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { apiFetch } from '../api/client'

const labels = ref(['一', '二', '三', '四', '五', '六', '日'])
const weeklyMinutes = ref([0, 0, 0, 0, 0, 0, 0])
const tasksDoneWeek = ref(0)
const habitsRateWeek = ref(0)
const ledgerCountWeek = ref(0)

const budgetMonths = ref<string[]>([])
const personalBudget = ref<Array<{ month: string; ratio: number }>>([])
const familyBudget = ref<Array<{ month: string; ratio: number }>>([])

const maxMinutes = computed(() => Math.max(1, ...weeklyMinutes.value))
const weeklyPercent = computed(() => weeklyMinutes.value.map((m) => Math.round((m / maxMinutes.value) * 100)))

const totalMinutes = computed(() => weeklyMinutes.value.reduce((a, b) => a + b, 0))
const focusHoursText = computed(() => (totalMinutes.value / 60).toFixed(1) + ' 小时')

const fetchStats = async () => {
  try {
    const data = await apiFetch<{
      labels: string[]
      focusMinutes: number[]
      tasksDone?: number
      habitsRate?: number
      ledgerCount?: number
    }>('/stats/weekly')
    if (data.labels?.length) labels.value = data.labels
    if (data.focusMinutes?.length) weeklyMinutes.value = data.focusMinutes
    tasksDoneWeek.value = data.tasksDone ?? tasksDoneWeek.value
    habitsRateWeek.value = data.habitsRate ?? habitsRateWeek.value
    ledgerCountWeek.value = data.ledgerCount ?? ledgerCountWeek.value
  } catch {
    // ignore
  }
}

const fetchBudgetStats = async () => {
  try {
    const data = await apiFetch<any>('/stats/budget')
    budgetMonths.value = data.months ?? []
    personalBudget.value = data.personal ?? []
    familyBudget.value = data.family ?? []
  } catch {
    // ignore
  }
}

const normalizeRatio = (value: number) => Math.max(0, Math.min(100, Number(value || 0)))

const budgetRows = computed(() =>
  budgetMonths.value.map((month, idx) => ({
    month,
    personal: normalizeRatio(personalBudget.value[idx]?.ratio ?? 0),
    family: normalizeRatio(familyBudget.value[idx]?.ratio ?? 0)
  }))
)

onMounted(() => {
  fetchStats()
  fetchBudgetStats()
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="section-title">
          <h2>数据统计</h2>
        </div>

        <div class="stat-grid">
          <div class="stat-card"><span>本周完成任务</span><strong>{{ tasksDoneWeek }}</strong></div>
          <div class="stat-card"><span>本周专注时长</span><strong>{{ focusHoursText }}</strong></div>
          <div class="stat-card"><span>习惯完成率</span><strong>{{ habitsRateWeek }}%</strong></div>
          <div class="stat-card"><span>记账记录</span><strong>{{ ledgerCountWeek }} 条</strong></div>
        </div>

        <div class="chart-card">
          <h3>本周节奏</h3>
          <div class="bar-chart">
            <div v-for="(minutes, idx) in weeklyMinutes" :key="idx" class="bar-item">
              <div class="bar-value">{{ minutes }}m</div>
              <div class="bar" :style="{ height: weeklyPercent[idx] + '%' }"></div>
              <span>{{ labels[idx] }}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <h3>结余比例（个人 / 家庭）</h3>
          <div class="budget-chart">
            <div v-for="row in budgetRows" :key="row.month" class="budget-item">
              <div class="budget-month">{{ row.month }}</div>
              <div class="budget-bars">
                <div class="budget-bar-track">
                  <div class="budget-bar personal" :style="{ width: row.personal + '%' }"></div>
                </div>
                <div class="budget-bar-track">
                  <div class="budget-bar family" :style="{ width: row.family + '%' }"></div>
                </div>
              </div>
              <div class="budget-meta">个人 {{ row.personal }}% · 家庭 {{ row.family }}%</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.budget-chart {
  display: grid;
  gap: 12px;
}

.budget-item {
  display: grid;
  gap: 8px;
}

.budget-month {
  font-size: 12px;
  color: var(--text-muted);
}

.budget-bars {
  display: grid;
  gap: 8px;
}

.budget-bar-track {
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border) 40%, transparent);
  overflow: hidden;
}

.budget-bar {
  height: 100%;
  border-radius: 999px;
}

.budget-bar.personal {
  background: linear-gradient(90deg, #38bdf8, #6366f1);
}

.budget-bar.family {
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.budget-meta {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
