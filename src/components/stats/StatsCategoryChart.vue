<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import type { EChartsOption } from 'echarts'
import EChartsView from './EChartsView.vue'

interface CategoryItem {
  category_id: number
  category: string
  amount: number
  percent: number
}

const props = defineProps<{
  items: CategoryItem[]
  total: number
}>()

const viewport = shallowRef(typeof window !== 'undefined' ? window.innerWidth : 1280)
const onResize = () => {
  viewport.value = window.innerWidth
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

const isMobile = computed(() => viewport.value <= 720)
const reversedItems = computed(() => [...props.items].reverse())

const donutOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'pie',
      radius: isMobile.value ? ['44%', '66%'] : ['48%', '72%'],
      center: ['50%', '46%'],
      avoidLabelOverlap: true,
      minAngle: 8,
      label: {
        show: !isMobile.value,
        formatter: ({ name, percent }) => `${name} ${percent}%`,
        color: '#cbd5e1',
        fontSize: 12
      },
      labelLine: {
        show: !isMobile.value,
        length: 12,
        length2: 10,
        lineStyle: { color: 'rgba(148,163,184,0.65)' }
      },
      data: props.items.map((i) => ({ name: i.category, value: i.amount }))
    }
  ]
}))

const barOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 16, left: 12, right: 12, bottom: 18, containLabel: true },
  xAxis: {
    type: 'value',
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } }
  },
  yAxis: {
    type: 'category',
    data: reversedItems.value.map((i) => i.category),
    axisLabel: { color: '#94a3b8', fontSize: isMobile.value ? 11 : 12 },
    axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } }
  },
  series: [
    {
      type: 'bar',
      data: reversedItems.value.map((i) => i.amount),
      itemStyle: { color: '#6366f1' },
      barWidth: 14,
      borderRadius: [8, 8, 8, 8]
    }
  ]
}))
</script>

<template>
  <div class="grid">
    <div class="card">
      <div class="title">支出分类构成（Top5）</div>
      <div v-if="isMobile" class="mobile-list">
        <div v-for="item in items" :key="item.category_id" class="mobile-row">
          <span class="mobile-name">{{ item.category }}</span>
          <span class="mobile-percent">{{ item.percent }}%</span>
        </div>
      </div>
      <EChartsView :options="donutOptions" :height="isMobile ? 260 : 300" />
    </div>
    <div class="card">
      <div class="title">分类支出排行</div>
      <EChartsView :options="barOptions" :height="300" />
    </div>
  </div>
</template>

<style scoped>
.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:12px; }
.card { padding:16px; border-radius:16px; border:1px solid color-mix(in srgb, var(--border) 70%, transparent); background: color-mix(in srgb, var(--surface) 70%, transparent); display:grid; gap:10px; }
.title { font-size:14px; font-weight:600; }
.mobile-list { display:grid; gap:6px; }
.mobile-row { display:flex; justify-content:space-between; gap:12px; font-size:12px; color:var(--text-muted); }
.mobile-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mobile-percent { white-space:nowrap; font-weight:600; color:var(--text); }
</style>
