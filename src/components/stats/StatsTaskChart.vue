<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import type { EChartsOption } from 'echarts'
import EChartsView from './EChartsView.vue'
import { formatPercent } from '../../utils/format'

interface DailyPoint {
  date: string
  value: number
}

const props = defineProps<{
  done: number
  total: number
  daily: DailyPoint[]
}>()

const viewport = shallowRef(typeof window !== 'undefined' ? window.innerWidth : 1280)
const onResize = () => {
  viewport.value = window.innerWidth
}
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
const isMobile = computed(() => viewport.value <= 720)

const undone = computed(() => Math.max(0, props.total - props.done))
const rate = computed(() => (props.total > 0 ? (props.done / props.total) * 100 : 0))

const summaryOptions = computed<EChartsOption>(() => ({
  grid: { top: 18, left: 18, right: 18, bottom: 8, containLabel: true },
  xAxis: {
    type: 'value',
    max: Math.max(props.total, 1),
    axisLabel: { show: false },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false }
  },
  yAxis: {
    type: 'category',
    data: ['已完成', '待完成'],
    axisLabel: { color: '#cbd5e1', fontSize: isMobile.value ? 11 : 12 },
    axisLine: { show: false },
    axisTick: { show: false }
  },
  series: [
    {
      type: 'bar',
      data: [props.done, undone.value],
      barWidth: 16,
      itemStyle: {
        borderRadius: [8, 8, 8, 8],
        color: (params: any) => (params.dataIndex === 0 ? '#22c55e' : 'rgba(148,163,184,0.28)')
      },
      label: {
        show: true,
        position: 'right',
        color: '#e2e8f0',
        formatter: ({ value }: any) => String(value)
      }
    }
  ]
}))

const trendOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 20, left: 12, right: 12, bottom: 24, containLabel: true },
  xAxis: {
    type: 'category',
    data: props.daily.map((d) => d.date.slice(8)),
    axisLabel: { color: '#94a3b8', fontSize: isMobile.value ? 11 : 12 },
    axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } }
  },
  series: [
    {
      type: 'line',
      smooth: true,
      data: props.daily.map((d) => d.value),
      areaStyle: { opacity: 0.16, color: '#38bdf8' },
      lineStyle: { width: 3, color: '#38bdf8' },
      itemStyle: { color: '#38bdf8' }
    }
  ]
}))
</script>

<template>
  <div class="grid">
    <div class="card">
      <div class="title">任务完成概览</div>
      <div class="meta">{{ done }} / {{ total }}（{{ formatPercent(rate) }}）</div>
      <EChartsView :options="summaryOptions" :height="isMobile ? 180 : 200" />
    </div>
    <div class="card">
      <div class="title">每日完成趋势</div>
      <EChartsView :options="trendOptions" :height="isMobile ? 220 : 240" />
    </div>
  </div>
</template>

<style scoped>
.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px; }
.card { padding:16px; border-radius:16px; border:1px solid color-mix(in srgb, var(--border) 70%, transparent); background: color-mix(in srgb, var(--surface) 70%, transparent); display:grid; gap:8px; }
.title { font-size:14px; font-weight:600; }
.meta { font-size:12px; color:var(--text-muted); }
</style>
