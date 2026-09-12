import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastTone } from './toastContext'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const TONE_CLASSES: Record<ToastTone, string> = {
  neutral: 'border-brand-navy/10 bg-surface text-brand-navy',
  success: 'border-success/30 bg-success-bg text-success',
  error: 'border-error/30 bg-error-bg text-error',
}

/**
 * A lightweight, non-blocking toast — for confirmations that currently
 * rely on a persistent inline banner (e.g. Settings' "saved" states).
 * Not yet mounted in `App.tsx`: this is a standalone, tested primitive
 * per the Phase 8A scope (build + test shared components first); it
 * gets wired in once a specific page in 8B+ actually calls `useToast()`
 * (re-exported from `./toastContext`, kept in its own file so this
 * component file exports only the component itself).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, options?: { tone?: ToastTone; durationMs?: number }) => {
    const id = nextId.current++
    const tone = options?.tone ?? 'neutral'
    const durationMs = options?.durationMs ?? 4000
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, durationMs)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={'pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-3 text-sm shadow-md ' + TONE_CLASSES[toast.tone]}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
