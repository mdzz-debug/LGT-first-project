import { ref } from 'vue'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: number
  type: ToastType
  message: string
}

const toasts = ref<Toast[]>([])
let seed = 1

export const useToast = () => {
  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  const pushToast = (message: string, type: ToastType = 'info', duration = 2600) => {
    const id = seed++
    toasts.value.push({ id, type, message })
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }

  return { toasts, pushToast, removeToast }
}

export const pushToast = (message: string, type: ToastType = 'info', duration = 2600) => {
  const { pushToast } = useToast()
  pushToast(message, type, duration)
}
