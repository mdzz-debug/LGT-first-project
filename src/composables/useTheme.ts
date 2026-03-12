import { onMounted, ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'warm'

export const useTheme = () => {
  const theme = ref<ThemeMode>('light')

  const applyTheme = (value: ThemeMode) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = value
      document.body.dataset.theme = value
    }
  }

  onMounted(() => {
    const saved = localStorage.getItem('pulse.theme') as ThemeMode | null
    if (saved) theme.value = saved
    applyTheme(theme.value)
  })

  watch(theme, (value) => {
    localStorage.setItem('pulse.theme', value)
    applyTheme(value)
  })

  return { theme, applyTheme }
}
