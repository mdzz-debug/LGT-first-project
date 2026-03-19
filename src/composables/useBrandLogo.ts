import { computed } from 'vue'
import logoUrl from '../assets/logo.png'
import logoWhiteUrl from '../assets/logo_white.png'
import { useTheme } from './useTheme'

export const useBrandLogo = () => {
  const { theme } = useTheme()

  const currentLogoUrl = computed(() => {
    return theme.value === 'dark' ? logoWhiteUrl : logoUrl
  })

  return {
    theme,
    currentLogoUrl
  }
}
