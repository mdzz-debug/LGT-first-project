<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import RecycleList from './RecycleList.vue'
import { apiFetch } from '../../api/client'
import { pushToast } from '../../composables/useToast'

const open = defineModel<boolean>('open', { required: true })

const tabs = ['tasks', 'habits', 'ledger'] as const
const activeTab = shallowRef<(typeof tabs)[number]>('tasks')
const loading = shallowRef(false)
const error = shallowRef('')

const taskItems = ref<any[]>([])
const habitItems = ref<any[]>([])
const ledgerItems = ref<any[]>([])

const pageSize = 5
const pageMap = reactive({
  tasks: 1,
  habits: 1,
  ledger: 1
})

const tabLabels: Record<(typeof tabs)[number], string> = {
  tasks: '任务回收站',
  habits: '习惯回收站',
  ledger: '记账回收站'
}

const tabDescriptions: Record<(typeof tabs)[number], string> = {
  tasks: '被移除的任务会在这里停留 30 天',
  habits: '恢复后依然保留连续天数',
  ledger: '恢复后会回到原账期'
}

const getRemainDays = (deletedAt?: string) => {
  if (!deletedAt) return null
  const safe = deletedAt.replace(' ', 'T')
  const deletedTime = new Date(safe).getTime()
  if (Number.isNaN(deletedTime)) return null
  const expireTime = deletedTime + 30 * 24 * 60 * 60 * 1000
  const diff = Math.ceil((expireTime - Date.now()) / (24 * 60 * 60 * 1000))
  return diff > 0 ? diff : 0
}

const fetchTasks = async () => {
  const data = await apiFetch<any[]>('/recycle/tasks')
  taskItems.value = data.map((item) => ({
    id: item.id,
    title: item.title,
    meta: `${item.category} · ${item.priority} · ${item.due_date ?? '未设日期'}`,
    deletedAt: item.deleted_at,
    remainDays: getRemainDays(item.deleted_at)
  }))
}

const fetchHabits = async () => {
  const data = await apiFetch<any[]>('/recycle/habits')
  habitItems.value = data.map((item) => ({
    id: item.id,
    title: item.name,
    meta: `目标 ${item.target} · 连续 ${item.streak} 天`,
    deletedAt: item.deleted_at,
    remainDays: getRemainDays(item.deleted_at)
  }))
}

const fetchLedger = async () => {
  const data = await apiFetch<any[]>('/recycle/ledger')
  ledgerItems.value = data.map((item) => ({
    id: item.id,
    title: item.note || '记账记录',
    meta: `${item.category} · ¥${item.amount} · ${item.date}`,
    deletedAt: item.deleted_at,
    remainDays: getRemainDays(item.deleted_at)
  }))
}

const fetchAll = async () => {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([fetchTasks(), fetchHabits(), fetchLedger()])
  } catch (err: any) {
    error.value = err?.message || '回收站加载失败'
  } finally {
    loading.value = false
  }
}

const restore = async (id: string | number) => {
  try {
    if (activeTab.value === 'tasks') {
      await apiFetch(`/recycle/tasks/${id}/restore`, { method: 'POST' })
      pushToast('任务已恢复，请到任务列表查看', 'success')
      await fetchTasks()
    }
    if (activeTab.value === 'habits') {
      await apiFetch(`/recycle/habits/${id}/restore`, { method: 'POST' })
      pushToast('习惯已恢复，请到习惯列表查看', 'success')
      await fetchHabits()
    }
    if (activeTab.value === 'ledger') {
      await apiFetch(`/recycle/ledger/${id}/restore`, { method: 'POST' })
      pushToast('记账已恢复，请到记账列表查看', 'success')
      await fetchLedger()
    }
  } catch {
    pushToast('恢复失败', 'error')
  }
}

const clearCurrent = async () => {
  if (!currentItems.value.length) {
    pushToast('当前回收站为空', 'info')
    return
  }
  if (typeof window !== 'undefined') {
    const ok = window.confirm('确定要清空当前回收站吗？此操作不可恢复。')
    if (!ok) return
  }
  try {
    await apiFetch('/recycle/clear', {
      method: 'POST',
      body: { type: activeTab.value }
    })
    pushToast('回收站已清空', 'success')
    pageMap[activeTab.value] = 1
    await fetchAll()
  } catch {
    pushToast('清空失败', 'error')
  }
}

const currentItems = computed(() => {
  if (activeTab.value === 'tasks') return taskItems.value
  if (activeTab.value === 'habits') return habitItems.value
  return ledgerItems.value
})

const currentPage = computed({
  get: () => pageMap[activeTab.value],
  set: (value) => {
    pageMap[activeTab.value] = value
  }
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(currentItems.value.length / pageSize))
)

const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return currentItems.value.slice(start, start + pageSize)
})

const goPrev = () => {
  if (currentPage.value > 1) currentPage.value -= 1
}

const goNext = () => {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}

const emptyText = computed(() => `${tabLabels[activeTab.value]}为空`)

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value
})

watch(
  open,
  (value) => {
    if (value) {
      fetchAll()
    }
  },
  { immediate: false }
)
</script>

<template>
  <Transition name="backdrop-fade">
    <div v-if="open" class="modal-backdrop" @click.self="open = false">
      <div class="modal recycle-modal">
        <div class="modal-head">
          <div>
            <h3>回收站</h3>
            <p class="muted">30 天后自动清理</p>
          </div>
          <div class="modal-head-actions">
            <button class="ghost danger" @click="clearCurrent">清空当前</button>
            <button class="ghost" @click="open = false">关闭</button>
          </div>
        </div>

        <div class="recycle-banner">⚠ 回收站内容将于 30 天后自动清除</div>

        <div class="recycle-tabs">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="recycle-tab"
            :class="activeTab === tab && 'active'"
            @click="activeTab = tab"
          >
            {{ tabLabels[tab] }}
          </button>
        </div>
        <p class="muted recycle-desc">{{ tabDescriptions[activeTab] }}</p>

        <div v-if="loading" class="empty-state">加载中…</div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>
        <RecycleList v-else :items="pagedItems" :empty-text="emptyText" @restore="restore" />

        <div class="recycle-pagination">
          <button class="ghost task-pill" :disabled="currentPage <= 1" @click="goPrev">上一页</button>
          <span class="muted">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button class="ghost task-pill" :disabled="currentPage >= totalPages" @click="goNext">下一页</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.recycle-modal {
  width: min(860px, calc(100vw - 40px));
  max-height: 85vh;
  overflow: hidden;
  display: grid;
  gap: 12px;
  background: color-mix(in srgb, var(--glass-strong) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  color: var(--text);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
}

.recycle-modal .muted {
  color: color-mix(in srgb, var(--text) 75%, transparent);
}

.recycle-modal::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at top right, rgba(239, 68, 68, 0.12), transparent 55%);
  pointer-events: none;
}

.modal-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.recycle-banner {
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #ef4444 45%, transparent);
  color: color-mix(in srgb, #ef4444 75%, var(--text));
  background: color-mix(in srgb, var(--glass-strong) 55%, transparent);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}

.recycle-tabs {
  display: inline-flex;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
}

.recycle-tab {
  padding: 6px 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  position: relative;
}

.recycle-tab.active {
  color: var(--text);
}

.recycle-tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -7px;
  height: 2px;
  background: #ef4444;
  border-radius: 999px;
}

.recycle-desc {
  margin-bottom: 8px;
  color: color-mix(in srgb, var(--text) 70%, transparent);
}

.recycle-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
</style>
