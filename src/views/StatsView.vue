<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'

const weekly = [32, 45, 28, 56, 40, 38, 60]
const labels = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="section-title">
          <h2>数据统计</h2>
        </div>

        <div class="stat-grid">
          <div class="stat-card"><span>本周完成任务</span><strong>18</strong></div>
          <div class="stat-card"><span>本周专注时长</span><strong>12.5 小时</strong></div>
          <div class="stat-card"><span>习惯完成率</span><strong>86%</strong></div>
          <div class="stat-card"><span>记账记录</span><strong>24 条</strong></div>
        </div>

        <div class="chart-card">
          <h3>本周节奏</h3>
          <div class="bar-chart">
            <div v-for="(value, idx) in weekly" :key="idx" class="bar-item">
              <div class="bar" :style="{ height: value + '%' }"></div>
              <span>{{ labels[idx] }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
