<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { theme } = useTheme()

const themes = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '暗黑' },
  { id: 'warm', label: '暖色' }
] as const

const login = () => {
  localStorage.setItem('pulse.token', 'demo-token')
  router.push('/dashboard')
}
</script>

<template>
  <div class="page" :data-theme="theme">
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
      </div>
    </header>

    <main class="auth">
      <section class="promo glass">
        <div class="badge">Login · Theme System</div>
        <h1>专为家庭 & 小团队设计的轻量协作</h1>
        <p>PulseList 把任务、习惯、专注节奏融在一个界面，支持多主题与成员共享。</p>

        <div class="highlight-grid">
          <div class="highlight">
            <h3>家庭共享</h3>
            <p>给家人分配任务、同步进度，减少沟通成本。</p>
          </div>
          <div class="highlight">
            <h3>番茄节奏</h3>
            <p>20-25 分钟深度专注，自动生成今日节奏回顾。</p>
          </div>
          <div class="highlight">
            <h3>AI 观察</h3>
            <p>根据完成度给出优先级与动能建议。</p>
          </div>
        </div>
      </section>

      <section class="login-card glass">
        <h2>欢迎回来</h2>
        <p class="muted">使用账号登录继续你的节奏。</p>

        <form class="form" @submit.prevent="login">
          <label>
            <span>账号</span>
            <input type="text" placeholder="请输入账号" />
          </label>
          <label>
            <span>密码</span>
            <input type="password" placeholder="请输入密码" />
          </label>
          <div class="row">
            <label class="checkbox">
              <input type="checkbox" checked />
              记住我
            </label>
            <a class="link" href="#">忘记密码？</a>
          </div>
          <button class="primary" type="submit">登录</button>
        </form>

        <p class="footnote">
          登录即代表你同意 <a class="link" href="#">服务条款</a> 与
          <a class="link" href="#">隐私政策</a>
        </p>
      </section>
    </main>
  </div>
</template>
