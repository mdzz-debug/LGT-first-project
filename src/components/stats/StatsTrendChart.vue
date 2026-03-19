<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import EChartsView from './EChartsView.vue'

interface TrendPoint {
  date: string
  income: number
  expense: number
}

interface Props {
  series: TrendPoint[]
  height?: number | string
}

const props = defineProps<Props>()

const labels = computed(() => props.series.map((item) => item.date.slice(5)))
const income = computed(() => props.series.map((item) => item.income))
const expense = computed(() => props.series.map((item) => item.expense))

const options = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, textStyle: { color: '#94a3b8' } },
  grid: { top: 36, left: 12, right: 12, bottom: 24, containLabel: true },
  xAxis: {
    type: 'category',
    data: labels.value,
    axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
    axisLabel: { color: '#94a3b8' }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } }
  },
  series: [
    {
      name: '收入',
      type: 'line',
      smooth: true,
      data: income.value,
      areaStyle: { opacity: 0.12 },
      color: '#22c55e'
    },
    {
      name: '支出',
      type: 'line',
      smooth: true,
      data: expense.value,
      areaStyle: { opacity: 0.12 },
      color: '#f97316'
    }
  ]
}))
</script>

<template>
  <div class="chart-block">
    <div class="chart-title">收支趋势</div>
    <EChartsView :options="options" :height="height || 300" />
  </div>
</template>

<style scoped>
.chart-block {
  display: grid;
  gap: 10px;
}

.chart-title {
  font-size: 14px;
  color: var(--text-muted);
}
</style>
