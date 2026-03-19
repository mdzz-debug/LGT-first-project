<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import iconDashboard from '@mdi/svg/svg/view-dashboard-outline.svg?raw'
import iconTasks from '@mdi/svg/svg/clipboard-check-outline.svg?raw'
import iconLedger from '@mdi/svg/svg/wallet-outline.svg?raw'
import iconStats from '@mdi/svg/svg/chart-line.svg?raw'
import iconThemeLight from '@mdi/svg/svg/weather-sunny.svg?raw'
import iconThemeDark from '@mdi/svg/svg/moon-waning-crescent.svg?raw'
import iconThemeWarm from '@mdi/svg/svg/fire.svg?raw'
import iconPalette from '@mdi/svg/svg/palette.svg?raw'
import { useBrandLogo } from '../composables/useBrandLogo'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'
import { useModalHub } from '../composables/useModalHub'
import RecycleBinModal from './recycle/RecycleBinModal.vue'

addCollection(mdi)

const route = useRoute()
const router = useRouter()
const { theme, currentLogoUrl } = useBrandLogo()

const navItems = [
  { label: '概览', path: '/dashboard', icon: iconDashboard },
  { label: '任务', path: '/tasks', icon: iconTasks },
  { label: '记账', path: '/ledger', icon: iconLedger },
  { label: '统计', path: '/stats', icon: iconStats }
]

const themes = [
  { id: 'light', label: '浅色', icon: iconThemeLight },
  { id: 'dark', label: '暗黑', icon: iconThemeDark },
  { id: 'warm', label: '暖色', icon: iconThemeWarm }
] as const

type PomodoroSettings = {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
}

const profileOpen = shallowRef(false)
const settingsOpen = shallowRef(false)
const mobileNavOpen = shallowRef(false)
const themeMenuOpen = shallowRef(false)

const { recycleOpen } = useModalHub()

const account = ref('')
const accountOriginal = ref('')
const nickname = ref('')

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

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

const saveSettings = async () => {
  localStorage.setItem(settingsKey, JSON.stringify(pomodoroSettings.value))

  // 1) 普通设置（昵称 + 番茄设置）
  try {
    await apiFetch('/users/me', {
      method: 'PATCH',
      body: {
        nickname: nickname.value,
        pomodoroSettings: pomodoroSettings.value
      }
    })
  } catch {
    pushToast('设置保存失败', 'error')
    return
  }

  // 2) 账号/密码（可选）
  const payload: Record<string, any> = {}
  const nextAccount = account.value.trim()
  if (nextAccount && nextAccount !== accountOriginal.value) {
    payload.account = nextAccount
  }

  const hasPwdInput = !!(oldPassword.value || newPassword.value || confirmPassword.value)
  if (hasPwdInput) {
    if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
      pushToast('请填写完整的密码字段', 'error')
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      pushToast('两次新密码不一致', 'error')
      return
    }
    payload.oldPassword = oldPassword.value
    payload.newPassword = newPassword.value
    payload.confirmPassword = confirmPassword.value
  }

  if (Object.keys(payload).length) {
    try {
      await apiFetch('/users/me/credentials', {
        method: 'PUT',
        body: payload
      })

      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } catch (err: any) {
      pushToast(err?.message || '账号/密码更新失败', 'error')
      return
    }
  }

  // 3) 刷新本地缓存（用于后续展示）
  try {
    const me = await apiFetch<any>('/users/me')
    localStorage.setItem('pulse.user', JSON.stringify(me))
    nickname.value = me.nickname ?? nickname.value
    account.value = me.account ?? account.value
    accountOriginal.value = me.account ?? accountOriginal.value
  } catch {
    // ignore
  }

  pushToast('设置已保存', 'success')
  settingsOpen.value = false
}

const logout = () => {
  localStorage.removeItem('pulse.token')
  localStorage.removeItem('pulse.user')
  router.push('/login')
}

const toggleProfile = () => {
  profileOpen.value = !profileOpen.value
}

const toggleMobileNav = () => {
  mobileNavOpen.value = !mobileNavOpen.value
}

const toggleThemeMenu = () => {
  themeMenuOpen.value = !themeMenuOpen.value
}

const openSettings = () => {
  settingsOpen.value = true
  profileOpen.value = false
  themeMenuOpen.value = false
  mobileNavOpen.value = false
}

const loadProfile = async () => {
  const cached = localStorage.getItem('pulse.user')
  if (cached) {
    try {
      const user = JSON.parse(cached)
      nickname.value = user.nickname || ''
      account.value = user.account || ''
      accountOriginal.value = account.value
    } catch {
      // ignore
    }
  }
  try {
    const user = await apiFetch<any>('/users/me')
    nickname.value = user.nickname || nickname.value
    account.value = user.account ?? account.value
    accountOriginal.value = user.account ?? accountOriginal.value
    if (user.pomodoroSettings) {
      pomodoroSettings.value = {
        focusMinutes: user.pomodoroSettings.focusMinutes ?? pomodoroSettings.value.focusMinutes,
        shortBreakMinutes: user.pomodoroSettings.shortBreakMinutes ?? pomodoroSettings.value.shortBreakMinutes,
        longBreakMinutes: user.pomodoroSettings.longBreakMinutes ?? pomodoroSettings.value.longBreakMinutes,
        longBreakEvery: user.pomodoroSettings.longBreakEvery ?? pomodoroSettings.value.longBreakEvery
      }
    }
  } catch {
    // ignore
  }
}

onMounted(loadProfile)
</script>

<template>
  <header class="topbar">
    <div class="brand" @click="router.push('/dashboard')">
      <button class="ghost mobile-menu-btn" @click.stop="toggleMobileNav" aria-label="打开导航">
        <span class="mdi mdi-menu"></span>
      </button>
      <span class="logo">
        <img :src="currentLogoUrl" alt="PulseHome logo" class="logo-img" />
      </span>
    </div>

    <nav class="nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="[route.path === item.path && 'active', item.label === '习惯' && 'nav-ai-host']"
        @click="router.push(item.path)"
      >
        <span class="nav-icon" v-html="item.icon"></span>
        {{ item.label }}
        <span v-if="item.label === '习惯'" class="nav-ai-badge">AI</span>
      </button>
    </nav>

    <div class="top-actions">
      <div class="theme-toggle">
        <button
          v-for="item in themes"
          :key="item.id"
          class="chip theme-chip"
          :class="theme === item.id && 'active'"
          @click="theme = item.id"
        >
          <span class="icon-svg" v-html="item.icon"></span>
          {{ item.label }}
        </button>
      </div>

      <div class="theme-menu">
        <button class="ghost theme-menu-btn" @click="toggleThemeMenu" aria-label="切换主题">
          <span class="icon-svg" v-html="iconPalette"></span>
        </button>
        <div v-if="themeMenuOpen" class="theme-popover">
          <button
            v-for="item in themes"
            :key="item.id"
            class="ghost theme-option"
            :class="theme === item.id && 'active'"
            @click="theme = item.id; themeMenuOpen = false"
          >
            <span class="icon-svg" v-html="item.icon"></span>
            {{ item.label }}
          </button>
        </div>
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
          <!-- 回收站入口已改为右下角浮标 -->
          <button class="ghost danger" @click="logout">
            <Icon icon="mdi:logout" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>

  <Transition name="backdrop-fade">
    <div v-if="mobileNavOpen" class="mobile-nav-backdrop" @click.self="mobileNavOpen = false">
      <div class="mobile-nav-panel">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="ghost mobile-nav-item"
          :class="route.path === item.path && 'active'"
          @click="router.push(item.path); mobileNavOpen = false"
        >
          <span class="icon-svg" v-html="item.icon"></span>
          {{ item.label }}
        </button>
      </div>
    </div>
  </Transition>

  <Transition name="backdrop-fade">
    <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false">
      <div class="modal settings-modal">
        <div class="modal-head">
          <h3>个人设置</h3>
          <button class="ghost" @click="settingsOpen = false">关闭</button>
        </div>
        <div class="modal-body settings-body">
          <div class="settings-grid">
            <section class="settings-section">
              <div class="settings-head">
                <h4>账户信息</h4>
                <p class="muted">用于展示与登录</p>
              </div>
              <label>
                <span>昵称</span>
                <input v-model="nickname" placeholder="输入昵称" />
              </label>

              <label>
                <span>登录账号</span>
                <input v-model="account" placeholder="用于登录（唯一）" />
              </label>
            </section>

            <section class="settings-section">
              <div class="settings-head">
                <h4>修改密码</h4>
                <p class="muted">填写旧密码 + 两次新密码才会更新</p>
              </div>
              <label>
                <span>旧密码</span>
                <input v-model="oldPassword" type="password" placeholder="请输入旧密码" />
              </label>
              <label>
                <span>新密码</span>
                <input v-model="newPassword" type="password" placeholder="请输入新密码" />
              </label>
              <label>
                <span>确认新密码</span>
                <input v-model="confirmPassword" type="password" placeholder="请再次输入新密码" />
              </label>
            </section>

            <section class="settings-section span-two">
              <div class="settings-head">
                <h4>番茄设置</h4>
                <p class="muted">专注与休息节奏</p>
              </div>
              <div class="settings-two-col">
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
            </section>
          </div>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="settingsOpen = false">取消</button>
          <button class="primary" @click="saveSettings">保存</button>
        </div>
      </div>
    </div>
  </Transition>

  <RecycleBinModal v-model:open="recycleOpen" />
</template>

<style scoped>
.settings-modal {
  width: min(820px, 94vw);
}

.settings-body {
  padding-top: 4px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-section {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: grid;
  gap: 12px;
}

.settings-section label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.settings-section input,
.settings-section select {
  width: 100%;
}

.settings-section.span-two {
  grid-column: 1 / -1;
}

.settings-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-head h4 {
  margin: 0;
  font-size: 14px;
}

.settings-head .muted {
  margin-top: 4px;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  .settings-two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .settings-modal {
    width: 92vw;
    max-height: 86vh;
    display: flex;
    flex-direction: column;
  }

  .settings-body {
    max-height: 62vh;
    overflow: auto;
  }
}
</style>
