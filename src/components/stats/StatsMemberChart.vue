<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import EChartsView from './EChartsView.vue'

interface MemberItem {
  user_id: number
  member: string
  amount: number
  percent: number
}

interface Props {
  items: MemberItem[]
}

const props = defineProps<Props>()

const options = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 16, left: 12, right: 12, bottom: 18, containLabel: true },
  xAxis: {
    type: 'value',
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } }
  },
  yAxis: {
    type: 'category',
    data: [...props.items].reverse().map((i) => i.member),
    axisLabel: { color: '#94a3b8' },
    axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } }
  },
  series: [
    {
      type: 'bar',
      data: [...props.items].reverse().map((i) => i.amount),
      itemStyle: { color: '#22c55e' },
      barWidth: 14
    }
  ]
}))
</script>

<template>
  <div class="card">
    <div class="title">成员支出占比</div>
    <EChartsView :options="options" :height="280" />
  </div>
</template>

<style scoped>
.card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  display: grid;
  gap: 10px;
}

.title {
  font-size: 14px;
  font-weight: 600;
}
</style>
