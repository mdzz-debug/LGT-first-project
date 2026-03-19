<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import EChartsView from './EChartsView.vue'
import { formatCurrency, formatPercent } from '../../utils/format'

interface BudgetCurvePoint {
  date: string
  spent: number
  target: number
}

interface Props {
  target: number
  spent: number
  remaining: number
  burnCurve: BudgetCurvePoint[]
}

const props = defineProps<Props>()
const ratio = computed(() => (props.target > 0 ? (props.spent / props.target) * 100 : 0))

const gaugeOptions = computed<EChartsOption>(() => ({
  series: [
    {
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: Math.max(props.target, props.spent, 1),
      progress: { show: true, width: 16, itemStyle: { color: '#6366f1' } },
      axisLine: { lineStyle: { width: 16, color: [[1, 'rgba(148,163,184,0.18)']] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '10%'],
        formatter: () => `{value|${formatPercent(ratio.value)}}\n{label|预算执行}`,
        rich: {
          value: {
            color: '#334155',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 30
          },
          label: {
            color: '#475569',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 24
          }
        }
      },
      data: [{ value: props.spent }]
    }
  ]
}))

const trendOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 24, left: 12, right: 12, bottom: 24, containLabel: true },
  xAxis: {
    type: 'category',
    data: props.burnCurve.map((p) => p.date.slice(8)),
    axisLabel: { color: '#64748b' },
    axisLine: { lineStyle: { color: 'rgba(100,116,139,0.35)' } }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } }
  },
  series: [
    {
      name: '累计支出',
      type: 'line',
      smooth: true,
      areaStyle: { opacity: 0.12 },
      lineStyle: { width: 3, color: '#8b5cf6' },
      itemStyle: { color: '#8b5cf6' },
      data: props.burnCurve.map((p) => p.spent)
    }
  ]
}))
</script>

<template>
  <div class="budget-grid">
    <div class="budget-card budget-summary">
      <div class="title">预算执行</div>
      <div class="budget-metrics">
        <div><span>预算</span><strong>{{ formatCurrency(target) }}</strong></div>
        <div><span>已花</span><strong>{{ formatCurrency(spent) }}</strong></div>
        <div><span>剩余</span><strong>{{ formatCurrency(remaining) }}</strong></div>
      </div>
      <div class="budget-progress">
        <div class="budget-progress-bar">
          <span :style="{ width: `${Math.min(ratio, 100)}%` }"></span>
        </div>
        <span class="budget-progress-text">{{ formatPercent(ratio) }}</span>
      </div>
      <EChartsView :options="gaugeOptions" :height="220" />
    </div>

    <div class="budget-card">
      <div class="title">预算趋势</div>
      <div class="meta muted">展示本月累计支出变化</div>
      <EChartsView :options="trendOptions" :height="260" />
    </div>
  </div>
</template>

<style scoped>
.budget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.budget-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  display: grid;
  gap: 10px;
}
.title { font-size: 14px; font-weight: 600; }
.meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--text-muted); }
.muted { color: var(--text-muted); }
.budget-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.budget-metrics span { display:block; font-size: 12px; color: var(--text-muted); }
.budget-metrics strong { display:block; margin-top: 4px; font-size: 16px; }
.budget-progress { display:flex; align-items:center; gap: 10px; }
.budget-progress-bar { flex:1; height: 10px; border-radius: 999px; background: rgba(148,163,184,0.16); overflow:hidden; }
.budget-progress-bar span { display:block; height:100%; border-radius:999px; background: linear-gradient(90deg,#6366f1,#8b5cf6); }
.budget-progress-text { font-size:12px; font-weight:600; color: var(--text); white-space:nowrap; }
</style>
