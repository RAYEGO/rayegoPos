import { apiRequest } from '@/services/apiClient'
import type {
  CreateInitialInventoryLoadPayload,
  CreateInitialInventoryLoadResponse,
  ListInitialInventoryLoadsResponse,
  PurgeTestDataPayload,
  PurgeTestDataResponse,
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

  purgeTestData(accessToken: string, payload: PurgeTestDataPayload) {
    return apiRequest<PurgeTestDataResponse>('/api/implementation/purge-test-data', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },
}
