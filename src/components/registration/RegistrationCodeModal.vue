<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { apiFetch } from '../../api/client'

const open = defineModel<boolean>('open', { required: true })

const state = reactive({
  loading: false,
  error: '',
  code: '',
  validFrom: '',
  validTo: ''
})

const title = computed(() => '注册口令')

const fetchCode = async () => {
  state.loading = true
  state.error = ''
  try {
    const data = await apiFetch<{ code: string; validFrom: string; validTo: string }>(
      '/admin/registration-code'
    )
    state.code = data.code
    state.validFrom = data.validFrom
    state.validTo = data.validTo
  } catch (err: any) {
    const msg = err?.message || '获取口令失败'
    if (msg === 'Forbidden') {
      state.error = '仅管理员可查看口令（请用 admin 登录）'
    } else if (msg === 'Unauthorized') {
      state.error = '请先登录后再查看口令'
    } else {
      state.error = msg
    }
  } finally {
    state.loading = false
  }
}

const rotate = async () => {
  state.loading = true
  state.error = ''
  try {
    const data = await apiFetch<{ code: string; validFrom: string; validTo: string }>(
      '/admin/registration-code/rotate',
      { method: 'POST' }
    )
    state.code = data.code
    state.validFrom = data.validFrom
    state.validTo = data.validTo
  } catch (err: any) {
    const msg = err?.message || '刷新口令失败'
    if (msg === 'Forbidden') {
      state.error = '仅管理员可生成新口令（请用 admin 登录）'
    } else if (msg === 'Unauthorized') {
      state.error = '请先登录后再生成口令'
    } else {
      state.error = msg
    }
  } finally {
    state.loading = false
  }
}

const copy = async () => {
  if (!state.code) return
  try {
    await navigator.clipboard.writeText(state.code)
  } catch {
    // ignore
  }
}

watch(
  open,
  (value) => {
    if (!value) return
    fetchCode()
  },
  { immediate: false }
)
</script>

<template>
  <Transition name="backdrop-fade">
    <div v-if="open" class="modal-backdrop" @click.self="open = false">
      <div class="modal registration-code-modal">
        <div class="modal-head">
          <h3>{{ title }}</h3>
          <button class="ghost" @click="open = false">关闭</button>
        </div>

        <div class="modal-body">
          <p class="muted">用于飞书私聊注册：先发“我要注册”，再发口令。</p>

          <div class="code-card">
            <div class="code-line">
              <span class="code">{{ state.loading ? '加载中…' : state.code || '—' }}</span>
              <button class="ghost task-pill" :disabled="!state.code" @click="copy">复制</button>
            </div>
            <div class="code-meta muted">
              有效期：{{ state.validFrom || '—' }} ~ {{ state.validTo || '—' }}
            </div>
          </div>

          <p v-if="state.error" class="error-text">{{ state.error }}</p>
        </div>

        <div class="modal-actions">
          <button class="ghost" @click="fetchCode" :disabled="state.loading">刷新</button>
          <button class="primary" @click="rotate" :disabled="state.loading">生成新口令</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.registration-code-modal {
  width: min(520px, calc(100vw - 40px));
}

.code-card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
}

.code-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 18px;
  letter-spacing: 1px;
}

.code-meta {
  margin-top: 8px;
  font-size: 12px;
}
</style>
