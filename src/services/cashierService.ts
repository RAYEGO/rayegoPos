import { apiRequest } from '@/services/apiClient'
import type {
  CashierDashboardResponse,
  OpenCashDrawerPayload,
  CloseCashDrawerPayload,
  CreateCashMovementPayload,
  CashReconciliationPreviewResponse,
  SaveCashReconciliationPayload,
  SaveCashReconciliationResponse,
} from '@/types/cashier'

type CashierDashboardFilters = {
  branchId?: string
}

function buildQuery(filters: CashierDashboardFilters) {
  const searchParams = new URLSearchParams()

  if (filters.branchId) {
    searchParams.set('branchId', filters.branchId)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const cashierService = {
  getDashboard(accessToken: string, filters: CashierDashboardFilters = {}) {
    return apiRequest<CashierDashboardResponse>(
      `/api/cashier/dashboard${buildQuery(filters)}`,
      {
        accessToken,
      }
    )
  },

  openDrawer(accessToken: string, payload: OpenCashDrawerPayload) {
    return apiRequest<{ success: boolean; openingId: string }>('/api/cashier/open', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  closeDrawer(accessToken: string, payload: CloseCashDrawerPayload) {
    return apiRequest<{ success: boolean; closingId: string }>('/api/cashier/close', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  createMovement(accessToken: string, payload: CreateCashMovementPayload) {
    return apiRequest<{ success: boolean; movementId: string }>('/api/cashier/movement', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  getReconciliationPreview(accessToken: string, openingId: string) {
    const searchParams = new URLSearchParams()
    searchParams.set('openingId', openingId)
    return apiRequest<CashReconciliationPreviewResponse>(
      `/api/cashier/reconciliation/preview?${searchParams.toString()}`,
      {
        accessToken,
      },
    )
  },

  saveReconciliation(accessToken: string, payload: SaveCashReconciliationPayload) {
    return apiRequest<SaveCashReconciliationResponse>('/api/cashier/reconciliation', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },
}
