import { useEffect, useState } from 'react'

// Per-device preferences only. Storage can be unavailable (private mode, blocked site
// data), so every access is guarded and the app works without it.
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...initial, ...JSON.parse(raw) } : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* not persisted; fine */
    }
  }, [key, value])
  return [value, setValue]
}

export interface DisplayPrefs {
  largeText: boolean
  highContrast: boolean
}
export const DEFAULT_DISPLAY: DisplayPrefs = { largeText: false, highContrast: false }
