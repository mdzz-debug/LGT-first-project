export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api'

type ApiOptions = Omit<RequestInit, 'body'> & { body?: any }

export async function apiFetch<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem('pulse.token')
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(options.body)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  })

  if (res.status === 401) {
    localStorage.removeItem('pulse.token')
    localStorage.removeItem('pulse.user')
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      message = data.error || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}
