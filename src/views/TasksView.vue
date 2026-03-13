<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'
import AppHeader from '../components/AppHeader.vue'

addCollection(mdi)

type Task = {
  id: string
  title: string
  category: string
  priority: 'P1' | 'P2' | 'P3'
  due: string
  done: boolean
  icon: string
}

const categories = ['家庭', '工作', '健康', '学习']
const priorities: Array<Task['priority']> = ['P1', 'P2', 'P3']

const tasks = ref<Task[]>([
  {
    id: 't1',
    title: '梳理下周家庭计划与预算',
    category: '家庭',
    priority: 'P1',
    due: '今天 18:00',
    done: false,
    icon: 'mdi:home-heart'
  },
  {
    id: 't2',
    title: '完成客户需求梳理 & 会议纪要',
    category: '工作',
    priority: 'P1',
    due: '今天 20:00',
    done: true,
    icon: 'mdi:briefcase-outline'
  },
  {
    id: 't3',
    title: '30 分钟力量训练',
    category: '健康',
    priority: 'P2',
    due: '今晚',
    done: false,
    icon: 'mdi:dumbbell'
  },
  {
    id: 't4',
    title: '读完《高效能人士》第四章',
    category: '学习',
    priority: 'P3',
    due: '明天',
    done: false,
    icon: 'mdi:book-open-page-variant'
  }
])

const query = ref('')
const statusFilter = ref<'all' | 'todo' | 'done'>('all')
const priorityFilter = ref<'all' | Task['priority']>('all')
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<{
  title: string
  category: string
  priority: Task['priority']
  due: string
  icon: string
}>({
  title: '',
  category: categories[0] ?? '家庭',
  priority: priorities[1] ?? 'P2',
  due: '',
  icon: 'mdi:checkbox-marked-circle-outline'
})

const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    const hitQuery = task.title.includes(query.value.trim())
    const hitStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'done' ? task.done : !task.done)
    const hitPriority =
      priorityFilter.value === 'all' || task.priority === priorityFilter.value
    return hitQuery && hitStatus && hitPriority
  })
})

const completed = computed(() => tasks.value.filter((t) => t.done).length)
const completion = computed(() =>
  tasks.value.length ? Math.round((completed.value / tasks.value.length) * 100) : 0
)
const overdue = computed(() => tasks.value.filter((t) => t.due.includes('昨天')).length)

const openCreate = () => {
  editingId.value = null
  form.value = {
    title: '',
    category: categories[0] ?? '家庭',
    priority: priorities[1] ?? 'P2',
    due: '',
    icon: 'mdi:checkbox-marked-circle-outline'
  }
  modalOpen.value = true
}

const openEdit = (task: Task) => {
  editingId.value = task.id
  form.value = {
    title: task.title,
    category: task.category,
    priority: task.priority,
    due: task.due,
    icon: task.icon
  }
  modalOpen.value = true
}

const saveTask = () => {
  if (!form.value.title.trim()) return
  if (editingId.value) {
    tasks.value = tasks.value.map((task) =>
      task.id === editingId.value
        ? { ...task, ...form.value }
        : task
    )
  } else {
    tasks.value.unshift({
      id: `t${Date.now()}`,
      title: form.value.title,
      category: form.value.category,
      priority: form.value.priority,
      due: form.value.due || '今天',
      done: false,
      icon: form.value.icon
    })
  }
  modalOpen.value = false
}

const removeTask = (id: string) => {
  tasks.value = tasks.value.filter((task) => task.id !== id)
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="content">
      <section class="panel glass">
        <div class="task-board-head">
          <div>
            <h2>任务管理</h2>
            <p class="muted">共 {{ tasks.length }} 项 · 已完成 {{ completed }} · 进行中 {{ tasks.length - completed }}</p>
          </div>
          <button class="primary task-pill" @click="openCreate">新建任务</button>
        </div>

        <div class="task-toolbar">
          <div class="task-filters">
            <div class="search">
              <Icon icon="mdi:magnify" />
              <input v-model="query" placeholder="搜索任务" />
            </div>
            <select v-model="statusFilter">
              <option value="all">全部</option>
              <option value="todo">待办</option>
              <option value="done">已完成</option>
            </select>
            <select v-model="priorityFilter">
              <option value="all">优先级</option>
              <option v-for="item in priorities" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </div>

        </div>

        <div class="stat-grid compact">
          <div class="stat-card"><span>总任务</span><strong>{{ tasks.length }}</strong></div>
          <div class="stat-card"><span>已完成</span><strong>{{ completed }}</strong></div>
          <div class="stat-card"><span>完成度</span><strong>{{ completion }}%</strong></div>
          <div class="stat-card"><span>逾期</span><strong>{{ overdue }}</strong></div>
        </div>

        <ul class="task-list">
          <li v-for="task in filteredTasks" :key="task.id" class="task-item">
            <div class="task-icon">
              <Icon :icon="task.icon" />
            </div>
            <div class="task-body">
              <div class="task-title" :class="task.done && 'done'">{{ task.title }}</div>
              <div class="task-meta">
                <span class="tag">{{ task.category }}</span>
                <span class="tag" :class="`priority-${task.priority}`">{{ task.priority }}</span>
                <span class="tag">{{ task.due }}</span>
              </div>
            </div>
            <div class="task-actions">
              <span class="task-status task-pill" :class="task.done && 'done'">
                {{ task.done ? '已完成' : '进行中' }}
              </span>
              <button class="ghost task-pill" @click="openEdit(task)">编辑</button>
              <button class="ghost task-pill danger" @click="removeTask(task.id)">删除</button>
            </div>
          </li>
        </ul>
      </section>
    </main>

    <Transition name="backdrop-fade">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>{{ editingId ? '编辑任务' : '新建任务' }}</h3>
            <button class="ghost" @click="modalOpen = false">关闭</button>
          </div>
          <div class="modal-body">
            <label>
              <span>标题</span>
              <input v-model="form.title" placeholder="请输入任务标题" />
            </label>
            <label>
              <span>分类</span>
              <select v-model="form.category">
                <option v-for="item in categories" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select v-model="form.priority">
                <option v-for="item in priorities" :key="item" :value="item">{{ item }}</option>
              </select>
            </label>
            <label>
              <span>截止</span>
              <input v-model="form.due" placeholder="例如：今天 18:00" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="ghost" @click="modalOpen = false">取消</button>
            <button class="primary" @click="saveTask">保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
