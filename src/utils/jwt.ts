export type DecodedJwtPayload = {
  sub?: string
  email?: string
  typ?: 'access' | 'refresh' | 'reset-password' | string
  iat?: number
  exp?: number
  companyId?: string | null
  branchId?: string | null
  roles?: string[]
  [key: string]: unknown
}

function b64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  const padded = base64 + padding
  return decodeURIComponent(
    atob(padded)
      .split('')
      .map((ch) => `%${`00${ch.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(''),
  )
}

export function decodeJwtPayload(token: string | null | undefined): DecodedJwtPayload | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const decoded = b64UrlDecode(parts[1])
    const parsed = JSON.parse(decoded) as DecodedJwtPayload
    return parsed
  } catch {
    return null
  }
}

export function isTokenExpired(
  token: string | null | undefined,
  bufferMs = 0,
): boolean {
  const decoded = decodeJwtPayload(token)
  if (!decoded || typeof decoded.exp !== 'number') return true
  const expiryMs = decoded.exp * 1000
  return Date.now() + bufferMs >= expiryMs
}

export function getTokenTimeLeftMs(
  token: string | null | undefined,
): number | null {
  const decoded = decodeJwtPayload(token)
  if (!decoded || typeof decoded.exp !== 'number') return null
  const left = decoded.exp * 1000 - Date.now()
  return left < 0 ? 0 : left
}

export function isAccessTokenValid(
  token: string | null | undefined,
  bufferMs = 0,
): boolean {
  const decoded = decodeJwtPayload(token)
  if (!decoded) return false
  if (decoded.typ !== 'access') return false
  return !isTokenExpired(token, bufferMs)
}

export function isRefreshTokenValid(token: string | null | undefined): boolean {
  const decoded = decodeJwtPayload(token)
  if (!decoded) return false
  if (decoded.typ !== 'refresh') return false
  return !isTokenExpired(token)
}
