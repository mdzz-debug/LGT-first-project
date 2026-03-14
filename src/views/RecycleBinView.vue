<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import RecycleList from '../components/recycle/RecycleList.vue'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'

const tabs = ['tasks', 'habits', 'ledger'] as const

const activeTab = shallowRef<(typeof tabs)[number]>('tasks')
const loading = shallowRef(false)
const error = shallowRef('')

const taskItems = ref<any[]>([])
const habitItems = ref<any[]>([])
const ledgerItems = ref<any[]>([])

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

const fetchTasks = async () => {
  const data = await apiFetch<any[]>('/recycle/tasks')
  taskItems.value = data.map((item) => ({
    id: item.id,
    title: item.title,
    meta: `${item.category} · ${item.priority} · ${item.due_date ?? '未设日期'}`,
    deletedAt: item.deleted_at
  }))
}

const fetchHabits = async () => {
  const data = await apiFetch<any[]>('/recycle/habits')
  habitItems.value = data.map((item) => ({
    id: item.id,
    title: item.name,
    meta: `目标 ${item.target} · 连续 ${item.streak} 天`,
    deletedAt: item.deleted_at
  }))
}

const fetchLedger = async () => {
  const data = await apiFetch<any[]>('/recycle/ledger')
  ledgerItems.value = data.map((item) => ({
    id: item.id,
    title: item.note || '记账记录',
    meta: `${item.category} · ¥${item.amount} · ${item.date}`,
    deletedAt: item.deleted_at
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
      pushToast('任务已恢复', 'success')
      await fetchTasks()
    }
    if (activeTab.value === 'habits') {
      await apiFetch(`/recycle/habits/${id}/restore`, { method: 'POST' })
      pushToast('习惯已恢复', 'success')
      await fetchHabits()
    }
    if (activeTab.value === 'ledger') {
      await apiFetch(`/recycle/ledger/${id}/restore`, { method: 'POST' })
      pushToast('记账已恢复', 'success')
      await fetchLedger()
    }
  } catch {
    pushToast('恢复失败', 'error')
  }
}

const currentItems = computed(() => {
  if (activeTab.value === 'tasks') return taskItems.value
  if (activeTab.value === 'habits') return habitItems.value
  return ledgerItems.value
})

const totalCount = computed(() =>
  taskItems.value.length + habitItems.value.length + ledgerItems.value.length
)

const emptyText = computed(() => `${tabLabels[activeTab.value]}为空`)

onMounted(fetchAll)
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass recycle-panel">
        <div class="section-title">
          <div>
            <h2>回收站</h2>
            <p class="muted">30 天后自动清理 · 共 {{ totalCount }} 条</p>
          </div>
          <div class="recycle-banner">已删除内容可随时恢复</div>
        </div>

        <div class="recycle-summary">
          <div class="recycle-card tone-task">
            <h4>任务</h4>
            <strong>{{ taskItems.length }}</strong>
            <span>条待恢复</span>
          </div>
          <div class="recycle-card tone-habit">
            <h4>习惯</h4>
            <strong>{{ habitItems.length }}</strong>
            <span>条待恢复</span>
          </div>
          <div class="recycle-card tone-ledger">
            <h4>记账</h4>
            <strong>{{ ledgerItems.length }}</strong>
            <span>条待恢复</span>
          </div>
        </div>

        <div class="recycle-tabs">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="chip"
            :class="activeTab === tab && 'active'"
            @click="activeTab = tab"
          >
            {{ tabLabels[tab] }}
          </button>
        </div>
        <p class="muted recycle-desc">{{ tabDescriptions[activeTab] }}</p>

        <div v-if="loading" class="empty-state">加载中…</div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>
        <RecycleList v-else :items="currentItems" :empty-text="emptyText" @restore="restore" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.recycle-panel {
  position: relative;
  overflow: hidden;
}

.recycle-panel::after {
  content: '';
  position: absolute;
  right: -120px;
  top: -120px;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.25), transparent 70%);
  opacity: 0.6;
  pointer-events: none;
}

.recycle-banner {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: rgba(199, 210, 254, 0.9);
  background: rgba(99, 102, 241, 0.1);
  font-size: 12px;
}

.recycle-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 16px 0 20px;
}

.recycle-card {
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  gap: 6px;
}

.recycle-card strong {
  font-size: 22px;
}

.recycle-card span {
  font-size: 12px;
  color: var(--text-muted);
}

.tone-task {
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.35);
}

.tone-habit {
  box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.35);
}

.tone-ledger {
  box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.35);
}

.recycle-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.recycle-desc {
  margin-bottom: 16px;
}
</style>
