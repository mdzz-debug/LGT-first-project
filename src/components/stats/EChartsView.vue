<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface Props {
  options: EChartsOption
  height?: string | number
  loading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'chart-click', params: any): void }>()

const chartRef = useTemplateRef<HTMLDivElement>('chart')
const chart = shallowRef<echarts.ECharts | null>(null)

const applyOption = () => {
  if (!chartRef.value) return
  if (!chart.value) {
    chart.value = echarts.init(chartRef.value)
    chart.value.on('click', (params) => emit('chart-click', params))
  }
  chart.value.setOption(props.options, true)
}

const resize = () => {
  chart.value?.resize()
}

watch(
  () => props.options,
  () => applyOption(),
  { deep: true }
)

watch(
  () => props.loading,
  (loading) => {
    if (!chart.value) return
    if (loading) chart.value.showLoading({ maskColor: 'transparent' })
    else chart.value.hideLoading()
  },
  { immediate: true }
)

onMounted(() => {
  applyOption()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div class="echart" :style="{ height: typeof height === 'number' ? height + 'px' : height || '280px' }" ref="chart" />
</template>

<style scoped>
.echart {
  width: 100%;
}
</style>
