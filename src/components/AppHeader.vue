<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import { useTheme } from '../composables/useTheme'

addCollection(mdi)

const route = useRoute()
const router = useRouter()
const { theme } = useTheme()

const navItems = [
  { label: '概览', path: '/dashboard' },
  { label: '任务', path: '/tasks' },
  { label: '记账', path: '/ledger' },
  { label: '习惯', path: '/habits' },
  { label: '统计', path: '/stats' }
]

const themes = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '暗黑' },
  { id: 'warm', label: '暖色' }
] as const

type PomodoroSettings = {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
}

const profileOpen = ref(false)
const settingsOpen = ref(false)
const nickname = ref('罗董')

const settingsKey = 'pulse.pomodoro.settings'
const defaultSettings: PomodoroSettings = {
  focusMinutes: 30,
  shortBreakMinutes: 10,
  longBreakMinutes: 20,
  longBreakEvery: 4
}

const loadSettings = (): PomodoroSettings => {
  const raw = localStorage.getItem(settingsKey)
  if (!raw) return defaultSettings
  try {
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

const pomodoroSettings = ref<PomodoroSettings>(loadSettings())

const saveSettings = () => {
  localStorage.setItem(settingsKey, JSON.stringify(pomodoroSettings.value))
  settingsOpen.value = false
}

const logout = () => {
  localStorage.removeItem('pulse.token')
  router.push('/login')
}

const toggleProfile = () => {
  profileOpen.value = !profileOpen.value
}

const openSettings = () => {
  settingsOpen.value = true
  profileOpen.value = false
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
        :class="[route.path === item.path && 'active', item.label === '习惯' && 'nav-ai-host']"
        @click="router.push(item.path)"
      >
        {{ item.label }}
        <span v-if="item.label === '习惯'" class="nav-ai-badge">AI</span>
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

      <div class="profile">
        <button class="ghost profile-trigger" @click="toggleProfile">
          <Icon icon="mdi:account-circle" />
          <span>{{ nickname }}</span>
          <Icon icon="mdi:chevron-down" />
        </button>
        <div v-if="profileOpen" class="profile-popover">
          <button class="ghost" @click="openSettings">
            <Icon icon="mdi:cog" />
            个人设置
          </button>
          <button class="ghost danger" @click="logout">
            <Icon icon="mdi:logout" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>

  <Transition name="backdrop-fade">
    <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>个人设置</h3>
          <button class="ghost" @click="settingsOpen = false">关闭</button>
        </div>
        <div class="modal-body">
          <label>
            <span>昵称</span>
            <input v-model="nickname" placeholder="输入昵称" />
          </label>
          <label>
            <span>番茄专注时长（分钟）</span>
            <input v-model.number="pomodoroSettings.focusMinutes" type="number" min="10" />
          </label>
          <label>
            <span>短休息（分钟）</span>
            <input v-model.number="pomodoroSettings.shortBreakMinutes" type="number" min="5" />
          </label>
          <label>
            <span>长休息（分钟）</span>
            <input v-model.number="pomodoroSettings.longBreakMinutes" type="number" min="10" />
          </label>
          <label>
            <span>每多少轮长休息</span>
            <input v-model.number="pomodoroSettings.longBreakEvery" type="number" min="2" />
          </label>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="settingsOpen = false">取消</button>
          <button class="primary" @click="saveSettings">保存</button>
        </div>
      </div>
    </div>
  </Transition>
</template>
