<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'

const route = useRoute()
const router = useRouter()
const { theme } = useTheme()

const navItems = [
  { label: '概览', path: '/dashboard' },
  { label: '任务', path: '/tasks' },
  { label: '习惯', path: '/habits' },
  { label: '记账', path: '/ledger' },
  { label: '统计', path: '/stats' }
]

const themes = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '暗黑' },
  { id: 'warm', label: '暖色' }
] as const

const logout = () => {
  localStorage.removeItem('pulse.token')
  router.push('/login')
}
</script>

<template>
  <header class="topbar">
    <div class="brand" @click="router.push('/dashboard')">
      <span class="logo">P</span>
      <span>PulseList</span>
    </div>

    <nav class="nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="route.path === item.path && 'active'"
        @click="router.push(item.path)"
      >
        {{ item.label }}
      </button>
    </nav>

    <div class="top-actions">
      <div class="theme-toggle">
        <button
          v-for="item in themes"
          :key="item.id"
          class="chip"
          :class="theme === item.id && 'active'"
          @click="theme = item.id"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="user-pill">罗董</div>
      <button class="ghost" @click="logout">退出</button>
    </div>
  </header>
</template>
