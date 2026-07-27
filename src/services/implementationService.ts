import { apiRequest } from '@/services/apiClient'
import type {
  CreateInitialInventoryLoadPayload,
  CreateInitialInventoryLoadResponse,
  ListInitialInventoryLoadsResponse,
} from '@/types/implementation'

export const implementationService = {
  listInitialInventoryLoads(accessToken: string) {
    return apiRequest<ListInitialInventoryLoadsResponse>('/api/implementation/initial-inventory-loads', {
      accessToken,
    })
  },

  createInitialInventoryLoad(accessToken: string, payload: CreateInitialInventoryLoadPayload) {
    return apiRequest<CreateInitialInventoryLoadResponse>('/api/implementation/initial-inventory-loads', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },
}

