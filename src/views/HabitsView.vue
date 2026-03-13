<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'

addCollection(mdi)

type HabitMember = {
  id: string
  name: string
}

type Habit = {
  id: string
  name: string
  streak: number
  icon: string
  done: boolean
  target: number
  memberId: string
}

const habitMembers = ref<HabitMember[]>([
  { id: 'm1', name: '罗董' },
  { id: 'm2', name: '小李' }
])

const activeHabitMemberId = shallowRef(habitMembers.value[0]?.id ?? 'm1')
const defaultHabitIcon = 'mdi:check-circle-outline'

const habits = ref<Habit[]>([
  {
    id: 'h1',
    name: '晨间拉伸',
    streak: 8,
    icon: 'mdi:weather-sunny',
    done: true,
    target: 20,
    memberId: 'm1'
  },
  {
    id: 'h2',
    name: '英语 15 分钟',
    streak: 12,
    icon: 'mdi:translate',
    done: false,
    target: 30,
    memberId: 'm1'
  },
  {
    id: 'h3',
    name: '阅读 20 页',
    streak: 5,
    icon: 'mdi:book-open-variant',
    done: false,
    target: 25,
    memberId: 'm2'
  }
])

const modalOpen = ref(false)
const memberEditOpen = ref(false)
const newMemberName = ref('')
const editingId = ref<string | null>(null)
const form = ref({
  name: '',
  target: 20,
  icon: defaultHabitIcon,
  memberId: activeHabitMemberId.value
})

const filteredHabits = computed(() =>
  habits.value.filter((habit) => habit.memberId === activeHabitMemberId.value)
)

const total = computed(() => filteredHabits.value.length)
const completed = computed(() => filteredHabits.value.filter((h) => h.done).length)
const avgStreak = computed(() =>
  filteredHabits.value.length
    ? Math.round(
        filteredHabits.value.reduce((sum, h) => sum + h.streak, 0) /
          filteredHabits.value.length
      )
    : 0
)

const toggleHabit = (habit: Habit) => {
  habit.done = !habit.done
  habit.streak = habit.done ? habit.streak + 1 : Math.max(habit.streak - 1, 0)
}

const setActiveMember = (id: string) => {
  activeHabitMemberId.value = id
}

const addMember = () => {
  const name = newMemberName.value.trim()
  if (!name) return
  const id = `m${Date.now()}`
  habitMembers.value.push({ id, name })
  newMemberName.value = ''
  setActiveMember(id)
}

const removeMember = (id: string) => {
  habitMembers.value = habitMembers.value.filter((member) => member.id !== id)
  habits.value = habits.value.filter((habit) => habit.memberId !== id)
  if (activeHabitMemberId.value === id) {
    activeHabitMemberId.value = habitMembers.value[0]?.id ?? 'm1'
  }
}

const openCreate = () => {
  editingId.value = null
  form.value = {
    name: '',
    target: 20,
    icon: defaultHabitIcon,
    memberId: activeHabitMemberId.value
  }
  modalOpen.value = true
}

const openEdit = (habit: Habit) => {
  editingId.value = habit.id
  form.value = {
    name: habit.name,
    target: habit.target,
    icon: habit.icon,
    memberId: habit.memberId
  }
  modalOpen.value = true
}

const saveHabit = () => {
  if (!form.value.name.trim()) return
  if (editingId.value) {
    habits.value = habits.value.map((h) =>
      h.id === editingId.value
        ? {
            ...h,
            name: form.value.name,
            target: form.value.target,
            memberId: form.value.memberId
          }
        : h
    )
  } else {
    habits.value.unshift({
      id: `h${Date.now()}`,
      name: form.value.name,
      target: form.value.target,
      icon: defaultHabitIcon,
      streak: 0,
      done: false,
      memberId: form.value.memberId
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

        <div class="habit-tabs-bar">
          <div class="habit-member-tabs">
            <button
              v-for="member in habitMembers"
              :key="member.id"
              class="chip"
              :class="activeHabitMemberId === member.id && 'active'"
              @click="setActiveMember(member.id)"
            >
              {{ member.name }}
            </button>
            <button class="ghost task-pill" @click="memberEditOpen = true">人员管理</button>
          </div>
          <div class="ai-badge" title="AI 总结">AI</div>
        </div>

        <div class="stat-grid compact">
          <div class="stat-card"><span>习惯总数</span><strong>{{ total }}</strong></div>
          <div class="stat-card"><span>今日完成</span><strong>{{ completed }}</strong></div>
          <div class="stat-card"><span>平均连续</span><strong>{{ avgStreak }} 天</strong></div>
        </div>

        <div class="habit-grid">
          <div v-for="habit in filteredHabits" :key="habit.id" class="habit-card">
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
            <div class="field-readonly">
              <span>图标</span>
              <span class="muted">由系统/AI 自动生成（不可编辑）</span>
            </div>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="modalOpen = false">取消</button>
            <button class="primary" @click="saveHabit">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="backdrop-fade">
      <div v-if="memberEditOpen" class="modal-backdrop" @click.self="memberEditOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>人员管理</h3>
            <button class="ghost" @click="memberEditOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <div class="member-edit-list">
              <div v-for="member in habitMembers" :key="member.id" class="member-edit-item">
                <div class="member-edit-name">
                  <span class="tag">{{ member.id === activeHabitMemberId ? '当前' : '成员' }}</span>
                  <span>{{ member.name }}</span>
                </div>
                <div class="member-edit-actions">
                  <button class="ghost task-pill" @click="setActiveMember(member.id)">切换</button>
                  <button
                    class="ghost task-pill danger"
                    :disabled="habitMembers.length <= 1"
                    @click="removeMember(member.id)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>

            <div class="member-add">
              <input v-model="newMemberName" placeholder="新增成员" />
              <button class="ghost task-pill" @click="addMember">添加</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
