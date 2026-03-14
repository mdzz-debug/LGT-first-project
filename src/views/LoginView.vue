<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import { useTheme } from '../composables/useTheme'
import { apiFetch } from '../api/client'

const router = useRouter()
const { theme } = useTheme()

addCollection(mdi)

const themes = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '暗黑' },
  { id: 'warm', label: '暖色' }
] as const

const account = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const themeMenuOpen = shallowRef(false)

const toggleThemeMenu = () => {
  themeMenuOpen.value = !themeMenuOpen.value
}

const highlights = [
  { title: '家庭共享', desc: '给家人分配任务、同步进度，减少沟通成本。' },
  { title: '番茄节奏', desc: '20-25 分钟深度专注，自动生成今日节奏回顾。' },
  { title: 'AI 观察', desc: '根据完成度给出优先级与动能建议。' },
  { title: '日历安排', desc: '一屏掌控日程，拖拽安排更直观。' },
  { title: '习惯追踪', desc: '长期打卡可视化，趋势一目了然。' },
  { title: '家庭看板', desc: '多成员协作，任务清晰可见。' },
  { title: '每日提醒', desc: '关键事项自动提醒，避免遗忘。' },
  { title: '专注报告', desc: '统计专注时长，形成效率报告。' }
]

const highlightLoop = [...highlights, ...highlights]

const login = async () => {
  if (!account.value || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: {
        account: account.value,
        password: password.value
      }
    })
    localStorage.setItem('pulse.token', data.token)
    localStorage.setItem('pulse.user', JSON.stringify(data.user))
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="logo">P</span>
        <span>PulseList</span>
      </div>
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
        <div class="theme-menu">
          <button class="ghost theme-menu-btn" @click="toggleThemeMenu" aria-label="切换主题">
            <Icon class="icon" icon="mdi:palette" />
          </button>
          <div v-if="themeMenuOpen" class="theme-popover">
            <button
              v-for="item in themes"
              :key="item.id"
              class="ghost"
              :class="theme === item.id && 'active'"
              @click="theme = item.id; themeMenuOpen = false"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="auth">
      <section class="promo glass">
        <div class="badge">Login · Theme System</div>
        <h1>专为家庭 & 小团队设计的轻量协作</h1>
        <p>PulseList 把任务、习惯、专注节奏融在一个界面，支持多主题与成员共享。</p>

        <div class="highlight-viewport">
          <div class="highlight-track">
            <div v-for="(item, idx) in highlightLoop" :key="item.title + idx" class="highlight">
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="login-card glass">
        <h2>欢迎回来</h2>
        <p class="muted">使用账号登录继续你的节奏。</p>

        <form class="form" @submit.prevent="login">
          <label>
            <span>账号</span>
            <input v-model="account" type="text" placeholder="请输入账号" />
          </label>
          <label>
            <span>密码</span>
            <input v-model="password" type="password" placeholder="请输入密码" />
          </label>
          <div class="row row-right">
            <a class="link" href="#">忘记密码？</a>
          </div>
          <button class="primary primary-btn" type="submit" :disabled="loading">
            {{ loading ? '登录中…' : '登录' }}
          </button>
        </form>

        <p v-if="error" class="error-text">{{ error }}</p>

        <p class="footnote">
          登录即代表你同意 <a class="link" href="#">服务条款</a> 与
          <a class="link" href="#">隐私政策</a>
        </p>
      </section>
    </main>
  </div>
</template>
