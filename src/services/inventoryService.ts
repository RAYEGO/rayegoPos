import { apiRequest } from '@/services/apiClient'
import type {
  AdjustInventoryLotPayload,
  CreateInventoryLotPayload,
  InventoryDashboardResponse,
  InventoryLotStatus,
  TransferInventoryLotPayload,
} from '@/types/inventory'

type InventoryDashboardFilters = {
  search?: string
  status?: InventoryLotStatus
  branchId?: string
  productId?: string
}

function buildQuery(filters: InventoryDashboardFilters) {
  const searchParams = new URLSearchParams()

  if (filters.search?.trim()) {
    searchParams.set('search', filters.search.trim())
  }

  if (filters.status) {
    searchParams.set('status', filters.status)
  }

  if (filters.branchId) {
    searchParams.set('branchId', filters.branchId)
  }

  if (filters.productId) {
    searchParams.set('productId', filters.productId)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const inventoryService = {
  getDashboard(accessToken: string, filters: InventoryDashboardFilters = {}) {
    return apiRequest<InventoryDashboardResponse>(
      `/api/inventory/dashboard${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },

  createLot(accessToken: string, payload: CreateInventoryLotPayload) {
    return apiRequest<{ item: InventoryDashboardResponse['lots'][number] }>(
      '/api/inventory/lots',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  adjustLot(accessToken: string, payload: AdjustInventoryLotPayload) {
    return apiRequest<{ item: InventoryDashboardResponse['lots'][number] }>(
      '/api/inventory/lots/adjust',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  transferLot(accessToken: string, payload: TransferInventoryLotPayload) {
    return apiRequest<{ item: InventoryDashboardResponse['lots'][number] }>(
      '/api/inventory/lots/transfer',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },
}
