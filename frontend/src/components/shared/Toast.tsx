import { useEffect } from 'react'
import { useLeStudioStore } from '../../store'

export function ToastLayer() {
  const toasts = useLeStudioStore((s) => s.toasts)
  const removeToast = useLeStudioStore((s) => s.removeToast)

  useEffect(() => {
    const ids = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id)
      }, 2300),
    )
    return () => {
      ids.forEach((id) => window.clearTimeout(id))
    }
  }, [toasts, removeToast])

  return (
    <div id="toast-root" className="toast-root" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast show ${toast.kind}`} key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
