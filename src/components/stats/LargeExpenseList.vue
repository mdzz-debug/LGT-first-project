<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '../../utils/format'

interface Item {
  date: string
  amount: number
  category: string
  note: string
}

interface Props {
  items: Item[]
}

const props = defineProps<Props>()

const rows = computed(() => props.items || [])
</script>

<template>
  <div class="card">
    <div class="title">近7天大额支出</div>
    <div v-if="rows.length" class="list">
      <div v-for="row in rows" :key="row.date + row.amount" class="row">
        <div class="left">
          <div class="main">{{ row.category || '未分类' }} · {{ row.date }}</div>
          <div class="sub">{{ row.note }}</div>
        </div>
        <div class="amount">{{ formatCurrency(row.amount) }}</div>
      </div>
    </div>
    <div v-else class="empty">暂无数据</div>
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

.list {
  display: grid;
  gap: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
}

.left {
  min-width: 0;
}

.main {
  font-size: 13px;
}

.sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 52vw;
}

.amount {
  font-weight: 700;
}

.empty {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
