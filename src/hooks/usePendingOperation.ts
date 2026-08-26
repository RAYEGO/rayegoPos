import { useCallback, useEffect } from 'react'
import { useInactivityContext } from '@/contexts/InactivityProvider'
import {
  clearPendingOperation,
  readPendingOperation,
  savePendingOperation,
  type PendingOperationScope,
  type PendingOperationSnapshot,
} from '@/config/security'

export function usePendingOperation(
  scope: PendingOperationScope,
  label: string,
  hasUnsavedChanges: boolean,
  getSnapshot: () => Record<string, unknown>,
  onRestore?: (snapshot: Record<string, unknown>) => void,
) {
  const { pendingOperation, setPendingOperation } = useInactivityContext()

  useEffect(() => {
    const restored = readPendingOperation()
    if (restored && restored.scope === scope && onRestore) {
      try {
        onRestore(restored.payload)
      } catch {
      }
    }
  }, [scope, onRestore])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      if (pendingOperation?.scope === scope) {
        clearPendingOperation()
        setPendingOperation(null)
      }
      return
    }

    let cancelled = false
    const save = () => {
      if (cancelled) return
      try {
        const payload = getSnapshot()
        const snapshot: PendingOperationSnapshot = {
          scope,
          label,
          savedAt: new Date().toISOString(),
          payload,
        }
        savePendingOperation(snapshot)
        setPendingOperation(snapshot)
      } catch {
      }
    }

    save()
    const interval = window.setInterval(save, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [
    hasUnsavedChanges,
    scope,
    label,
    getSnapshot,
    setPendingOperation,
    pendingOperation,
  ])

  const clear = useCallback(() => {
    clearPendingOperation()
    setPendingOperation(null)
  }, [setPendingOperation])

  return {
    pendingOperation: pendingOperation?.scope === scope ? pendingOperation : null,
    clear,
  }
}
