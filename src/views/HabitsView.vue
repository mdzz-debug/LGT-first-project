<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { apiFetch } from '../api/client'
import { pushToast } from '../composables/useToast'
import { useRecycleFly } from '../composables/useRecycleFly'

type HabitMember = {
  id: string | number
  name: string
}

type Habit = {
  id: string | number
  name: string
  streak: number
  icon: string
  done: boolean
  target: number
  memberId: string | number
}

const habitMembers = ref<HabitMember[]>([])

const activeHabitMemberId = shallowRef<string | number>('')
const defaultHabitIcon = 'mdi:check-circle-outline'

const habits = ref<Habit[]>([])
const loading = shallowRef(false)
const error = shallowRef('')

const { flyToRecycle } = useRecycleFly()

const memberColors = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#14b8a6']
const memberColorMap = computed(() => {
  const map = new Map<string | number, string>()
  habitMembers.value.forEach((member, idx) => {
    const color = memberColors[idx % memberColors.length] ?? memberColors[0] ?? '#22c55e'
    map.set(member.id, color)
  })
  return map
})

const getMemberColor = (memberId: string | number) => {
  return memberColorMap.value.get(memberId) ?? memberColors[0]
}

const modalOpen = ref(false)
const memberEditOpen = ref(false)
const newMemberName = ref('')
const editingId = ref<string | number | null>(null)
const form = ref({
  name: '',
  target: 20,
  icon: defaultHabitIcon,
  memberId: activeHabitMemberId.value
})

const filteredHabits = computed(() =>
  habits.value.filter((habit) => String(habit.memberId) === String(activeHabitMemberId.value))
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

const fetchMembers = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await apiFetch<any[]>('/habit-members')
    habitMembers.value = data.map((m) => ({ id: m.id, name: m.name }))
    if (!activeHabitMemberId.value && habitMembers.value.length) {
      activeHabitMemberId.value = habitMembers.value[0]?.id ?? ''
    }
  } catch (err: any) {
    error.value = err?.message || '成员加载失败'
  } finally {
    loading.value = false
  }
}

const fetchHabits = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await apiFetch<any[]>('/habits')
    habits.value = data.map((h) => ({
      id: h.id,
      name: h.name,
      streak: Number(h.streak || 0),
      icon: h.icon || defaultHabitIcon,
      done: !!h.done,
      target: Number(h.target || 0),
      memberId: h.member_id ?? h.memberId
    }))
  } catch (err: any) {
    error.value = err?.message || '习惯加载失败'
  } finally {
    loading.value = false
  }
}

const toggleHabit = async (habit: Habit) => {
  const nextDone = !habit.done
  habit.done = nextDone
  habit.streak = habit.done ? habit.streak + 1 : Math.max(habit.streak - 1, 0)
  try {
    await apiFetch(`/habits/${habit.id}`, {
      method: 'PATCH',
      body: { done: nextDone }
    })
  } catch {
    pushToast('习惯状态更新失败', 'error')
  }
}

const setActiveMember = (id: string | number) => {
  activeHabitMemberId.value = id
}

const addMember = async () => {
  const name = newMemberName.value.trim()
  if (!name) return
  try {
    const member = await apiFetch<any>('/habit-members', {
      method: 'POST',
      body: { name }
    })
    newMemberName.value = ''
    await fetchMembers()
    setActiveMember(member.id)
    pushToast('成员已添加', 'success')
  } catch {
    pushToast('成员添加失败', 'error')
  }
}

const removeMember = async (id: string | number) => {
  if (typeof window !== 'undefined') {
    const ok = window.confirm('确认删除该成员吗？')
    if (!ok) return
  }
  try {
    await apiFetch(`/habit-members/${id}`, { method: 'DELETE' })
    await fetchMembers()
    await fetchHabits()
    if (activeHabitMemberId.value === id) {
      activeHabitMemberId.value = habitMembers.value[0]?.id ?? ''
    }
    pushToast('成员已删除', 'success')
  } catch {
    pushToast('成员删除失败', 'error')
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

const saveHabit = async () => {
  if (!form.value.name.trim()) return
  try {
    if (editingId.value) {
      await apiFetch(`/habits/${editingId.value}`, {
        method: 'PATCH',
        body: {
          name: form.value.name,
          target: form.value.target,
          memberId: form.value.memberId
        }
      })
      pushToast('习惯已更新', 'success')
    } else {
      await apiFetch('/habits', {
        method: 'POST',
        body: {
          name: form.value.name,
          target: form.value.target,
          memberId: form.value.memberId
        }
      })
      pushToast('习惯已创建', 'success')
    }
    await fetchHabits()
  } catch {
    pushToast('习惯保存失败', 'error')
  }
  modalOpen.value = false
}

const removeHabit = async (id: string | number, evt?: MouseEvent) => {
  if (typeof window !== 'undefined') {
    const ok = window.confirm('确认删除该习惯吗？')
    if (!ok) return
  }
  const sourceEl = (evt?.currentTarget as HTMLElement | null)?.closest('.habit-card') as HTMLElement | null
  flyToRecycle(sourceEl)
  try {
    await apiFetch(`/habits/${id}`, { method: 'DELETE' })
    await fetchHabits()
    pushToast('习惯已删除（已进入回收站）', 'success')
  } catch {
    pushToast('习惯删除失败', 'error')
  }
}

onMounted(async () => {
  await fetchMembers()
  await fetchHabits()
  if (!activeHabitMemberId.value && habitMembers.value.length) {
    activeHabitMemberId.value = habitMembers.value[0]?.id ?? ''
  }
})
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
              :class="String(activeHabitMemberId) === String(member.id) && 'active'"
              @click="setActiveMember(member.id)"
            >
              {{ member.name }}
            </button>
            <button class="ghost task-pill" @click="memberEditOpen = true">人员管理</button>
          </div>
          <div class="ai-badge" title="AI 总结">AI</div>
        </div>

        <div v-if="habitMembers.length" class="habit-legend">
          <span v-for="member in habitMembers" :key="member.id" class="legend-item">
            <span class="habit-dot" :style="{ backgroundColor: getMemberColor(member.id) }"></span>
            {{ member.name }}
          </span>
        </div>

        <div class="stat-grid compact">
          <div class="stat-card"><span>习惯总数</span><strong>{{ total }}</strong></div>
          <div class="stat-card"><span>今日完成</span><strong>{{ completed }}</strong></div>
          <div class="stat-card"><span>平均连续</span><strong>{{ avgStreak }} 天</strong></div>
        </div>

        <div v-if="loading" class="empty-state">加载中…</div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>
        <div v-else-if="!filteredHabits.length" class="empty-state">暂无习惯，点击右上角新建</div>

        <div v-else class="habit-grid">
          <div v-for="habit in filteredHabits" :key="habit.id" class="habit-card">
            <div>
              <div class="habit-title">
                <span class="habit-dot" :style="{ backgroundColor: getMemberColor(habit.memberId) }"></span>
                <h4>{{ habit.name }}</h4>
              </div>
              <p class="muted">目标 {{ habit.target }} 天 · 连续 {{ habit.streak }} 天</p>
            </div>
            <div class="habit-actions">
              <button class="ghost" @click="toggleHabit(habit)">
                {{ habit.done ? '已完成' : '打卡' }}
              </button>
              <button class="ghost" @click="openEdit(habit)">编辑</button>
              <button class="ghost danger" @click="removeHabit(habit.id, $event)">删除</button>
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
                  <span class="tag">{{ String(member.id) === String(activeHabitMemberId) ? '当前' : '成员' }}</span>
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
