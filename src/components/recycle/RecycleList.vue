<script setup lang="ts">
import type { PropType } from 'vue'

type RecycleItem = {
  id: string | number
  title: string
  meta: string
  deletedAt?: string
  remainDays?: number | null
}

const props = defineProps({
  items: {
    type: Array as PropType<RecycleItem[]>,
    default: () => []
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  }
})

const emit = defineEmits<{
  (e: 'restore', id: string | number): void
}>()
</script>

<template>
  <div v-if="!items.length" class="empty-state">{{ emptyText }}</div>
  <div v-else class="recycle-list">
    <div v-for="item in items" :key="item.id" class="recycle-item">
      <div class="recycle-body">
        <div class="recycle-title">
          <h4>{{ item.title }}</h4>
          <span v-if="item.deletedAt" class="recycle-time-pill">回收于 {{ item.deletedAt }}</span>
        </div>
        <div class="recycle-meta">
          <div
            v-if="item.remainDays !== null && item.remainDays !== undefined"
            class="recycle-countdown"
          >
            剩余 {{ item.remainDays }} 天自动清除
          </div>
        </div>
      </div>
      <div class="recycle-actions">
        <button class="recycle-restore" @click="emit('restore', item.id)">恢复</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recycle-list {
  display: grid;
  gap: 12px;
}

.recycle-item {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 18px 22px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, #ef4444 26%, var(--border));
  border-left: 4px solid color-mix(in srgb, #ef4444 70%, transparent);
  background: color-mix(in srgb, var(--glass-strong) 55%, transparent);
  color: var(--text);
  overflow: hidden;
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
}

.recycle-item::after {
  content: '';
  position: absolute;
  right: -40px;
  top: -40px;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.18), transparent 70%);
  pointer-events: none;
}

.recycle-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.recycle-body h4 {
  margin: 0;
  font-size: 16px;
}

.recycle-time-pill {
  font-size: 12px;
  color: color-mix(in srgb, #ef4444 72%, var(--text));
}

.recycle-meta {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.recycle-countdown {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  color: color-mix(in srgb, #ef4444 74%, var(--text));
}

.recycle-actions {
  display: flex;
  justify-content: flex-end;
}

.recycle-restore {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #ef4444 45%, transparent);
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: color-mix(in srgb, #ef4444 72%, var(--text));
  font-weight: 600;
  cursor: pointer;
}

.recycle-restore:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(239, 68, 68, 0.18);
}
</style>
