<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency, formatPercent } from '../../utils/format'

interface OverviewBlock {
  income: number
  expense: number
  balance: number
  budget_total: number
  budget_left: number
}

interface TaskBlock {
  done: number
  total: number
  rate: number
}

interface Props {
  personal: OverviewBlock
  family: OverviewBlock
  tasks: { personal: TaskBlock; family: TaskBlock }
}

const props = defineProps<Props>()

const familyCards = computed(() => [
  { label: '本月支出', value: formatCurrency(props.family.expense) },
  { label: '本月收入', value: formatCurrency(props.family.income) },
  { label: '预算剩余', value: formatCurrency(props.family.budget_left) },
  { label: '任务完成率', value: formatPercent(props.tasks.family.rate) }
])
</script>

<template>
  <div class="overview-grid">
    <div v-for="card in familyCards" :key="card.label" class="overview-card">
      <span class="overview-label">{{ card.label }}</span>
      <strong class="overview-value">{{ card.value }}</strong>
    </div>
  </div>
</template>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.overview-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 720px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-card {
    padding: 14px;
  }
}

@media (max-width: 420px) {
  .overview-value {
    font-size: 18px;
  }
}

.overview-label {
  font-size: 12px;
  color: var(--text-muted);
}

.overview-value {
  font-size: 20px;
}

.overview-sub {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
