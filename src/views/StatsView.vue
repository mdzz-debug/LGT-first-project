<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { useStatsDashboard } from '../composables/useStatsDashboard'

import StatsOverviewCards from '../components/stats/StatsOverviewCards.vue'
import StatsTrendChart from '../components/stats/StatsTrendChart.vue'
import StatsBudgetCharts from '../components/stats/StatsBudgetCharts.vue'
import StatsCategoryChart from '../components/stats/StatsCategoryChart.vue'
import StatsTaskChart from '../components/stats/StatsTaskChart.vue'
import LargeExpenseList from '../components/stats/LargeExpenseList.vue'

const {
  month,
  trendDays,
  loading,
  error,
  overview,
  trend,
  budgetTotal,
  categoryExpense,
  tasks,
  largeExpense,
  reload
} = useStatsDashboard()
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="panel-head">
          <div>
            <div class="kicker">家庭概览</div>
            <h1>统计</h1>
            <div class="muted">记账 · 任务 · 预算</div>
          </div>

          <div class="filters">
            <label class="filter">
              <span>月份</span>
              <input v-model="month" type="month" class="filter-input" />
            </label>

            <div class="filter">
              <span>趋势范围</span>
              <div class="seg">
                <button class="seg-btn" :class="{ active: trendDays === 7 }" @click="trendDays = 7">7天</button>
                <button class="seg-btn" :class="{ active: trendDays === 30 }" @click="trendDays = 30">30天</button>
                <button class="seg-btn" :class="{ active: trendDays === 90 }" @click="trendDays = 90">90天</button>
              </div>
            </div>

            <button class="btn" :disabled="loading" @click="reload">刷新</button>
          </div>
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <template v-if="overview && trend && budgetTotal && categoryExpense && tasks && largeExpense">
          <StatsOverviewCards
            :personal="overview.personal"
            :family="overview.family"
            :tasks="overview.tasks"
          />

          <StatsTrendChart :series="trend.series" />

          <StatsBudgetCharts
            :target="budgetTotal.target"
            :spent="budgetTotal.spent"
            :remaining="budgetTotal.remaining"
            :burn-curve="budgetTotal.burnCurve"
          />

          <StatsCategoryChart
            :items="categoryExpense.items"
            :total="categoryExpense.total"
          />

          <StatsTaskChart :done="tasks.done" :total="tasks.total" :daily="tasks.daily" />

          <LargeExpenseList :items="largeExpense.items" />
        </template>

        <div v-else class="loading">{{ loading ? '加载中…' : '暂无数据' }}</div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.filter-input {
  height: 36px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  color: var(--text);
}

.seg {
  display: inline-flex;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  overflow: hidden;
}

.seg-btn {
  height: 36px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.seg-btn.active {
  color: var(--text);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
}

.btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  cursor: pointer;
}

.error {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, #ef4444 10%, transparent);
  border: 1px solid color-mix(in srgb, #ef4444 35%, transparent);
  color: #fecaca;
}

.loading {
  padding: 12px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
