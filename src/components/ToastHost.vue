<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, removeToast } = useToast()
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast-fade" tag="div">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
        <span>{{ toast.message }}</span>
        <button class="toast-close" @click="removeToast(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 24px;
  top: 24px;
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toast {
  min-width: 200px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.9);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.25);
}

.toast.success {
  border-color: rgba(34, 197, 94, 0.5);
}

.toast.error {
  border-color: rgba(239, 68, 68, 0.5);
}

.toast.info {
  border-color: rgba(59, 130, 246, 0.5);
}

.toast-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
