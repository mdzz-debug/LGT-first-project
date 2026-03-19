<script setup lang="ts">
import { formatCurrency } from '../../utils/format'

interface DetailItem {
  id: number
  date: string
  amount: number
  category_id: number
  category: string
  note: string
  user_id: number
  member: string
}

const props = defineProps<{
  title: string
  items: DetailItem[]
}>()
</script>

<template>
  <div class="details-card">
    <div class="details-head">
      <div>
        <div class="title">{{ title }}</div>
        <div class="sub">点击柱状图后展示该分类的详细支出记录</div>
      </div>
      <div class="count">{{ items.length }} 笔</div>
    </div>

    <div v-if="items.length" class="details-list">
      <div v-for="item in items" :key="item.id" class="details-row">
        <div class="left">
          <div class="main">{{ item.member }} · {{ item.date }}</div>
          <div class="subtext">{{ item.note || '无备注' }}</div>
        </div>
        <div class="amount">{{ formatCurrency(item.amount) }}</div>
      </div>
    </div>
    <div v-else class="empty">点击右侧分类柱状图查看明细</div>
  </div>
</template>

<style scoped>
.details-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  display: grid;
  gap: 12px;
}

.details-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.title {
  font-size: 14px;
  font-weight: 600;
}

.sub,
.subtext,
.count,
.empty {
  font-size: 12px;
  color: var(--text-muted);
}

.details-list {
  display: grid;
  gap: 10px;
}

.details-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.left {
  min-width: 0;
}

.main {
  font-size: 13px;
  font-weight: 500;
}

.amount {
  font-weight: 700;
  white-space: nowrap;
}
</style>
