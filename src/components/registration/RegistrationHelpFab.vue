<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import RegistrationCodeModal from './RegistrationCodeModal.vue'

const route = useRoute()
const open = shallowRef(false)

const hasToken = computed(() => !!localStorage.getItem('pulse.token'))
const visible = computed(() => route.path !== '/login' && hasToken.value)
</script>

<template>
  <div v-if="visible" class="registration-fab">
    <button class="registration-fab-btn" @click="open = true">帮助</button>
    <RegistrationCodeModal v-model:open="open" />
  </div>
</template>

<style scoped>
.registration-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 90;
}

.registration-fab-btn {
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--glass);
  color: var(--text-primary);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.15);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  font-weight: 600;
  cursor: pointer;
}

.registration-fab-btn:hover {
  transform: translateY(-1px);
}
</style>
