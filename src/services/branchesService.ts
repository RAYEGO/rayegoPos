import { apiRequest } from '@/services/apiClient'
import type {
  Branch,
  CreateBranchPayload,
  UpdateBranchPayload,
} from '@/types/settings'

export const branchesService = {
  list(accessToken: string) {
    return apiRequest<Branch[]>('/api/settings/branches', {
      accessToken,
    })
  },

  create(accessToken: string, payload: CreateBranchPayload) {
    return apiRequest<Branch>('/api/settings/branches', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  get(accessToken: string, branchId: string) {
    return apiRequest<Branch>(`/api/settings/branches/${branchId}`, {
      accessToken,
    })
  },

  update(accessToken: string, branchId: string, payload: UpdateBranchPayload) {
    return apiRequest<Branch>(`/api/settings/branches/${branchId}`, {
      method: 'PUT',
      accessToken,
      body: payload,
    })
  },

  toggleStatus(accessToken: string, branchId: string) {
    return apiRequest<Branch>(
      `/api/settings/branches/${branchId}/toggle-status`,
      {
        method: 'PATCH',
        accessToken,
      },
    )
  },
}
