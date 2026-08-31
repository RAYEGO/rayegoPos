import { apiRequest } from '@/services/apiClient'

export type EnvironmentMode = 'development' | 'production' | 'staging' | 'unknown'

export type SystemEnvironment = {
  environment: EnvironmentMode
  api: string
  database: string
  branch: string | null
  databaseConnected: boolean
}

export type EnvironmentStatusBadge = {
  kind: 'dev' | 'prod' | 'other' | 'unknown'
  label: string
}

export function getEnvironmentBadge(mode?: EnvironmentMode | null): EnvironmentStatusBadge {
  if (mode === 'development') return { kind: 'dev', label: 'DEV' }
  if (mode === 'production') return { kind: 'prod', label: 'PROD' }
  if (mode === 'staging') return { kind: 'other', label: 'STG' }
  return { kind: 'unknown', label: '—' }
}

export const systemService = {
  async getEnvironment(options?: { accessToken?: string }): Promise<SystemEnvironment> {
    return apiRequest<SystemEnvironment>('/api/system/environment', {
      method: 'GET',
      accessToken: options?.accessToken,
    })
  },
}
