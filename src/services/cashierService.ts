import { apiRequest } from '@/services/apiClient'
import type {
  CashierDashboardResponse,
  OpenCashDrawerPayload,
  CloseCashDrawerPayload,
  CreateCashMovementPayload,
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
}
