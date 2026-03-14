<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { apiFetch } from '../api/client'

const labels = ref(['一', '二', '三', '四', '五', '六', '日'])
const weeklyMinutes = ref([0, 0, 0, 0, 0, 0, 0])
const tasksDoneWeek = ref(0)
const habitsRateWeek = ref(0)
const ledgerCountWeek = ref(0)

const maxMinutes = computed(() => Math.max(1, ...weeklyMinutes.value))
const weeklyPercent = computed(() =>
  weeklyMinutes.value.map((m) => Math.round((m / maxMinutes.value) * 100))
)

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
    if (data.labels?.length) {
      labels.value = data.labels
    }
    if (data.focusMinutes?.length) {
      weeklyMinutes.value = data.focusMinutes
    }
    tasksDoneWeek.value = data.tasksDone ?? tasksDoneWeek.value
    habitsRateWeek.value = data.habitsRate ?? habitsRateWeek.value
    ledgerCountWeek.value = data.ledgerCount ?? ledgerCountWeek.value
  } catch {
    // ignore
  }
}

onMounted(fetchStats)
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
      </section>
    </main>
  </div>
</template>
