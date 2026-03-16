<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'

addCollection(mdi)

export type CategoryOption = {
  value: string
  label: string
  icon?: string
}

const props = defineProps<{
  modelValue: string
  options: CategoryOption[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = shallowRef(false)

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) || null)

const close = () => {
  open.value = false
}

const toggle = () => {
  open.value = !open.value
}

const select = (value: string) => {
  emit('update:modelValue', value)
  close()
}

const onDocClick = (evt: MouseEvent) => {
  const target = evt.target as HTMLElement | null
  if (!target) return
  if (target.closest('.cat-select')) return
  close()
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocClick)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', onDocClick)
  }
})
</script>

<template>
  <div class="cat-select" :class="open && 'open'">
    <button type="button" class="cat-trigger" @click="toggle">
      <span class="cat-left">
        <Icon class="cat-icon" :icon="selected?.icon || 'mdi:tag-outline'" />
        <span class="cat-label">{{ selected?.label || props.placeholder || '请选择' }}</span>
      </span>
      <Icon class="cat-caret" :icon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
    </button>

    <div v-if="open" class="cat-menu">
      <button
        v-for="opt in props.options"
        :key="opt.value"
        type="button"
        class="cat-item"
        :class="opt.value === props.modelValue && 'active'"
        @click="select(opt.value)"
      >
        <span class="cat-left">
          <Icon class="cat-icon" :icon="opt.icon || 'mdi:tag-outline'" />
          <span class="cat-label">{{ opt.label }}</span>
        </span>
        <Icon v-if="opt.value === props.modelValue" class="cat-check" icon="mdi:check" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.cat-select {
  position: relative;
  width: 100%;
}

.cat-trigger {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: var(--surface);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.cat-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cat-icon {
  width: 16px;
  height: 16px;
  color: color-mix(in srgb, var(--text) 80%, transparent);
  flex: 0 0 auto;
}

.cat-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.cat-caret {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  flex: 0 0 auto;
}

.cat-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 20;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--glass-strong) 92%, var(--bg-2));
  box-shadow: var(--shadow-soft);
  display: grid;
  gap: 6px;
  max-height: 240px;
  overflow: auto;
}

.cat-item {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  padding: 8px 10px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.cat-item:hover {
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.cat-item.active {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--primary) 25%, transparent);
}

.cat-check {
  width: 16px;
  height: 16px;
  color: var(--primary);
}
</style>
