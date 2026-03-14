<script setup lang="ts">
import { RouterView } from 'vue-router'
import FloatingFabMenu from './components/FloatingFabMenu.vue'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <RouterView />
  <FloatingFabMenu />
  <ToastHost />
</template>
