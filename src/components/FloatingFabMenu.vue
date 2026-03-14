<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import { apiFetch } from '../api/client'
import { useModalHub } from '../composables/useModalHub'
import RegistrationCodeModal from './registration/RegistrationCodeModal.vue'

addCollection(mdi)

const route = useRoute()
const expanded = shallowRef(false)
const loading = shallowRef(false)
const counts = ref({ total: 0, tasks: 0, habits: 0, ledger: 0 })
const isAdmin = ref(false)

const { recycleOpen, registrationOpen } = useModalHub()

const hasToken = computed(() => !!localStorage.getItem('pulse.token'))
const visible = computed(() => route.path !== '/login' && hasToken.value)

const fetchCounts = async () => {
  if (!hasToken.value) return
  loading.value = true
  try {
    const data = await apiFetch<{ total: number; tasks: number; habits: number; ledger: number }>(
      '/recycle/counts'
    )
    counts.value = {
      total: data.total ?? 0,
      tasks: data.tasks ?? 0,
      habits: data.habits ?? 0,
      ledger: data.ledger ?? 0
    }
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

const toggle = () => {
  expanded.value = !expanded.value
  if (expanded.value) fetchCounts()
}

const openRecycle = () => {
  recycleOpen.value = true
  expanded.value = false
}

const openHelp = () => {
  registrationOpen.value = true
  expanded.value = false
}

watch(recycleOpen, (value) => {
  if (!value) fetchCounts()
})

let timer: number | null = null

const loadRole = async () => {
  const cached = localStorage.getItem('pulse.user')
  if (cached) {
    try {
      const user = JSON.parse(cached)
      isAdmin.value = user.account === 'admin'
    } catch {
      // ignore
    }
  }
  try {
    const user = await apiFetch<any>('/users/me')
    isAdmin.value = user.account === 'admin'
  } catch {
    // ignore
  }
}

onMounted(() => {
  if (visible.value) fetchCounts()
  loadRole()
  if (typeof window !== 'undefined') {
    timer = window.setInterval(() => {
      if (!hasToken.value) return
      fetchCounts()
    }, 15000)
  }
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
  timer = null
})
</script>

<template>
  <div v-if="visible" class="fab-group">
    <div v-if="expanded" class="fab-bubble">
      <button v-if="isAdmin" class="fab-item" @click="openHelp">
        <Icon class="icon" icon="mdi:help-circle-outline" />
        <span>帮助</span>
      </button>
      <button class="fab-item" @click="openRecycle">
        <Icon class="icon" icon="mdi:trash-can-outline" />
        <span>回收站</span>
        <span v-if="counts.total > 0" class="fab-badge">{{ counts.total }}</span>
      </button>
    </div>

    <button class="fab-main recycle-fab" @click="toggle" title="快捷操作">
      <Icon class="icon" :icon="expanded ? 'mdi:close' : 'mdi:recycle'" />
      <span v-if="counts.total > 0" class="fab-main-badge">{{ counts.total }}</span>
      <span v-if="loading" class="fab-pulse"></span>
    </button>

    <RegistrationCodeModal v-model:open="registrationOpen" />
  </div>
</template>

<style scoped>
.fab-group {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.fab-main {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-strong);
  border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
  box-shadow: var(--shadow-glow);
  color: var(--text);
  backdrop-filter: blur(16px) saturate(140%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.fab-main:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.fab-main-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.fab-pulse {
  position: absolute;
  inset: -6px;
  border-radius: 22px;
  border: 1px dashed color-mix(in srgb, var(--primary) 45%, transparent);
  animation: fab-pulse 1.6s ease infinite;
  pointer-events: none;
}

@keyframes fab-pulse {
  0% { opacity: 0.6; transform: scale(0.96); }
  70% { opacity: 0; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.2); }
}

.fab-bubble {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  background: var(--glass-strong);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(16px) saturate(140%);
}

.fab-item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
}

.fab-item:hover {
  transform: translateY(-1px);
}

.fab-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 720px) {
  .fab-group {
    right: 16px;
    bottom: 16px;
  }

  .fab-main {
    width: 48px;
    height: 48px;
    border-radius: 16px;
  }
}
</style>
