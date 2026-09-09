export const SECURITY_STORAGE_PREFIX = 'rayego-pos.security'

export const INACTIVITY_STORAGE_KEY = `${SECURITY_STORAGE_PREFIX}.inactivity-state`
export const PENDING_OPERATION_STORAGE_KEY = `${SECURITY_STORAGE_PREFIX}.pending-operation`
export const SECURITY_SETTINGS_STORAGE_KEY = `${SECURITY_STORAGE_PREFIX}.settings`

export type SecurityTimeoutSettings = {
  idleTimeoutMs: number
  warningCountdownMs: number
  accessTokenExpiryBufferMs: number
}

export const DEFAULT_SECURITY_TIMEOUTS: SecurityTimeoutSettings = import.meta.env.DEV
  ? {
      idleTimeoutMs: 30 * 1000,
      warningCountdownMs: 10 * 1000,
      accessTokenExpiryBufferMs: 60 * 1000,
    }
  : {
      idleTimeoutMs: 10 * 60 * 1000,
      warningCountdownMs: 2 * 60 * 1000,
      accessTokenExpiryBufferMs: 60 * 1000,
    }

export type PendingOperationScope =
  | 'sales.checkout'
  | 'purchases.edit'
  | 'products.form'
  | 'customers.form'
  | 'suppliers.form'
  | 'cashier.open'
  | 'generic.form'

export type PendingOperationSnapshot = {
  scope: PendingOperationScope
  label: string
  savedAt: string
  payload: Record<string, unknown>
}

export function readSecurityTimeouts(): SecurityTimeoutSettings {
  try {
    const raw = window.localStorage.getItem(SECURITY_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SECURITY_TIMEOUTS
    const parsed = JSON.parse(raw) as Partial<SecurityTimeoutSettings>
    const minIdleMs = import.meta.env.DEV ? 5_000 : 10_000
    const minWarningMs = import.meta.env.DEV ? 5_000 : 10_000
    const minBufferMs = 5_000
    return {
      idleTimeoutMs:
        typeof parsed.idleTimeoutMs === 'number' && parsed.idleTimeoutMs > minIdleMs
          ? parsed.idleTimeoutMs
          : DEFAULT_SECURITY_TIMEOUTS.idleTimeoutMs,
      warningCountdownMs:
        typeof parsed.warningCountdownMs === 'number' && parsed.warningCountdownMs >= minWarningMs
          ? parsed.warningCountdownMs
          : DEFAULT_SECURITY_TIMEOUTS.warningCountdownMs,
      accessTokenExpiryBufferMs:
        typeof parsed.accessTokenExpiryBufferMs === 'number' && parsed.accessTokenExpiryBufferMs >= minBufferMs
          ? parsed.accessTokenExpiryBufferMs
          : DEFAULT_SECURITY_TIMEOUTS.accessTokenExpiryBufferMs,
    }
  } catch {
    return DEFAULT_SECURITY_TIMEOUTS
  }
}

export function writeSecurityTimeouts(value: SecurityTimeoutSettings): void {
  window.localStorage.setItem(SECURITY_SETTINGS_STORAGE_KEY, JSON.stringify(value))
}

export function savePendingOperation(snapshot: PendingOperationSnapshot): void {
  window.localStorage.setItem(PENDING_OPERATION_STORAGE_KEY, JSON.stringify(snapshot))
}

export function readPendingOperation(): PendingOperationSnapshot | null {
  const raw = window.localStorage.getItem(PENDING_OPERATION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingOperationSnapshot
  } catch {
    return null
  }
}

export function clearPendingOperation(): void {
  window.localStorage.removeItem(PENDING_OPERATION_STORAGE_KEY)
}
