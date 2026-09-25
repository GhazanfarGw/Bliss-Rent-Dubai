import { useSyncExternalStore } from 'react'

/**
 * Live `window.matchMedia(query).matches`, re-rendering when it flips.
 * Falls back to `false` wherever matchMedia doesn't exist (jsdom in unit
 * tests, SSR) — callers should treat `false` as the small-screen default.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      if (typeof mql.addEventListener !== 'function') return () => {}
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => typeof window !== 'undefined' && !!window.matchMedia && !!window.matchMedia(query)?.matches,
    () => false,
  )
}
