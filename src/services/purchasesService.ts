import { apiRequest } from '@/services/apiClient'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderStatus,
  PurchasesDashboardResponse,
  RegisterPurchasePaymentPayload,
  ReturnPurchaseItemPayload,
  ReceivePurchaseItemPayload,
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

  receiveItem(accessToken: string, payload: ReceivePurchaseItemPayload) {
    return apiRequest<{ item: { id: string; detailId: string; purchaseId: string } }>(
      '/api/purchases/receipts',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  returnItem(accessToken: string, payload: ReturnPurchaseItemPayload) {
    return apiRequest<{ item: { id: string; detailId: string; purchaseId: string } }>(
      '/api/purchases/returns',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  registerPayment(accessToken: string, payload: RegisterPurchasePaymentPayload) {
    return apiRequest<{ item: { id: string; purchaseId: string; amount: number } }>(
      '/api/purchases/payments',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },
}
