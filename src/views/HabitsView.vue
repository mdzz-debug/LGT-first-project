<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'

addCollection(mdi)

type Habit = {
  id: string
  name: string
  streak: number
  icon: string
  done: boolean
  target: number
}

const habits = ref<Habit[]>([
  { id: 'h1', name: '晨间拉伸', streak: 8, icon: 'mdi:weather-sunny', done: true, target: 20 },
  { id: 'h2', name: '英语 15 分钟', streak: 12, icon: 'mdi:translate', done: false, target: 30 },
  { id: 'h3', name: '阅读 20 页', streak: 5, icon: 'mdi:book-open-variant', done: false, target: 25 }
])

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  name: '',
  target: 20,
  icon: 'mdi:check-circle-outline'
})

const total = computed(() => habits.value.length)
const completed = computed(() => habits.value.filter((h) => h.done).length)
const avgStreak = computed(() =>
  habits.value.length
    ? Math.round(habits.value.reduce((sum, h) => sum + h.streak, 0) / habits.value.length)
    : 0
)

const toggleHabit = (habit: Habit) => {
  habit.done = !habit.done
  habit.streak = habit.done ? habit.streak + 1 : Math.max(habit.streak - 1, 0)
}

const openCreate = () => {
  editingId.value = null
  form.value = { name: '', target: 20, icon: 'mdi:check-circle-outline' }
  modalOpen.value = true
}

const openEdit = (habit: Habit) => {
  editingId.value = habit.id
  form.value = { name: habit.name, target: habit.target, icon: habit.icon }
  modalOpen.value = true
}

const saveHabit = () => {
  if (!form.value.name.trim()) return
  if (editingId.value) {
    habits.value = habits.value.map((h) =>
      h.id === editingId.value ? { ...h, ...form.value } : h
    )
  } else {
    habits.value.unshift({
      id: `h${Date.now()}`,
      name: form.value.name,
      target: form.value.target,
      icon: form.value.icon,
      streak: 0,
      done: false
    })
  }
  modalOpen.value = false
}

const removeHabit = (id: string) => {
  habits.value = habits.value.filter((h) => h.id !== id)
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="section-title">
          <h2>习惯管理</h2>
          <button class="primary" @click="openCreate">新建习惯</button>
        </div>

        <div class="stat-grid compact">
          <div class="stat-card"><span>习惯总数</span><strong>{{ total }}</strong></div>
          <div class="stat-card"><span>今日完成</span><strong>{{ completed }}</strong></div>
          <div class="stat-card"><span>平均连续</span><strong>{{ avgStreak }} 天</strong></div>
        </div>

        <div class="habit-grid">
          <div v-for="habit in habits" :key="habit.id" class="habit-card">
            <div class="habit-icon">
              <Icon :icon="habit.icon" />
            </div>
            <div>
              <h4>{{ habit.name }}</h4>
              <p class="muted">目标 {{ habit.target }} 天 · 连续 {{ habit.streak }} 天</p>
            </div>
            <div class="habit-actions">
              <button class="ghost" @click="toggleHabit(habit)">
                {{ habit.done ? '已完成' : '打卡' }}
              </button>
              <button class="ghost" @click="openEdit(habit)">编辑</button>
              <button class="ghost danger" @click="removeHabit(habit.id)">删除</button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <Transition name="backdrop-fade">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>{{ editingId ? '编辑习惯' : '新建习惯' }}</h3>
            <button class="ghost" @click="modalOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <label>
              <span>名称</span>
              <input v-model="form.name" placeholder="例如：阅读 20 页" />
            </label>
            <label>
              <span>目标</span>
              <input v-model.number="form.target" type="number" min="1" />
            </label>
            <label>
              <span>图标</span>
              <input v-model="form.icon" placeholder="mdi:check-circle-outline" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="modalOpen = false">取消</button>
            <button class="primary" @click="saveHabit">保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
