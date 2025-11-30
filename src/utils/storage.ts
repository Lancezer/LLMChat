const STORAGE_KEY = 'llmchat:v1'

type PersistedState<T> = {
  version: number
  data: T
}

export function loadFromStorage<T>(fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as PersistedState<T>
    return parsed.data
  } catch (error) {
    console.warn('[storage] Failed to parse persisted state', error)
    return fallback
  }
}

export function saveToStorage<T>(data: T) {
  if (typeof window === 'undefined') return
  const payload: PersistedState<T> = { version: 1, data }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearStorage() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
