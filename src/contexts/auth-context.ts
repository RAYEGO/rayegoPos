import { createContext } from 'react'
import type {
  AuthSession,
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  ResetPasswordPayload,
} from '@/types/auth'

export type AuthContextValue = {
  session: AuthSession | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: (reason?: string) => Promise<void>
  requestPasswordReset: (
    payload: ForgotPasswordPayload,
  ) => Promise<ForgotPasswordResult>
  resetPassword: (payload: ResetPasswordPayload) => Promise<void>
  setSession: (next: AuthSession | null) => void
  syncSessionFromStorage: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
