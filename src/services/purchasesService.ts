import { apiRequest } from '@/services/apiClient'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderStatus,
  PurchasesDashboardResponse,
} from '@/types/purchases'

type PurchaseDashboardFilters = {
  search?: string
  status?: PurchaseOrderStatus
  branchId?: string
  supplierId?: string
}

function buildQuery(filters: PurchaseDashboardFilters) {
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

  if (filters.supplierId) {
    searchParams.set('supplierId', filters.supplierId)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const purchasesService = {
  getDashboard(accessToken: string, filters: PurchaseDashboardFilters = {}) {
    return apiRequest<PurchasesDashboardResponse>(
      `/api/purchases/dashboard${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },

  createOrder(accessToken: string, payload: CreatePurchaseOrderPayload) {
    return apiRequest<{ item: PurchasesDashboardResponse['orders'][number] }>(
      '/api/purchases/orders',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },
}
