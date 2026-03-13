<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '../components/AppHeader.vue'

// 模拟数据：用于 UI/图表占位（后续接 API 时替换即可）
const labels = ['一', '二', '三', '四', '五', '六', '日']

// 每日专注分钟（本周节奏）
const weeklyMinutes = [95, 120, 65, 140, 80, 50, 110]

const maxMinutes = computed(() => Math.max(...weeklyMinutes))
const weeklyPercent = computed(() =>
  weeklyMinutes.map((m) => Math.round((m / maxMinutes.value) * 100))
)

const totalMinutes = computed(() => weeklyMinutes.reduce((a, b) => a + b, 0))
const focusHoursText = computed(() => (totalMinutes.value / 60).toFixed(1) + ' 小时')

const tasksDoneWeek = 18
const habitsRateWeek = 86
const ledgerCountWeek = 24
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
