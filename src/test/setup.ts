import '@testing-library/jest-dom/vitest'
// Initializes i18next (English by default) so components using useTranslation()
// render real copy instead of raw translation keys under test.
import '@/i18n'

// jsdom does not implement matchMedia. Components guard against it being
// undefined (see src/lib/motion.ts), so this isn't required for them to run
// — but stubbing it lets tests explicitly exercise the
// prefers-reduced-motion path (`window.matchMedia = () => ({ matches: true, ... })`)
// instead of only the "not supported" fallback.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

/**
 * jsdom also has no IntersectionObserver (used by StickySearchBar). This
 * fake keeps the constructor's callback so a test can invoke it directly
 * (`instance.trigger({ isIntersecting, boundingClientRect: { top } })`) to
 * simulate scrolling the observed element in or out of view.
 */
class FakeIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    // Tests can reach the most recently constructed observer via this global
    // (e.g. `(window as any).__lastIntersectionObserver.trigger({...})`)
    // rather than needing the component to expose its internal instance.
    ;(window as unknown as { __lastIntersectionObserver?: FakeIntersectionObserver }).__lastIntersectionObserver =
      this
  }
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
  takeRecords = () => []
  trigger(entry: Partial<IntersectionObserverEntry>) {
    this.callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  // @ts-expect-error — simplified test double, not a spec-complete implementation
  window.IntersectionObserver = FakeIntersectionObserver
  // @ts-expect-error — mirror onto globalThis too, since components reference the bare global
  globalThis.IntersectionObserver = FakeIntersectionObserver
}
