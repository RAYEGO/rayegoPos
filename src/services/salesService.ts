import { apiRequest } from '@/services/apiClient'
import type { CreateSalePayload, SalesDashboardResponse } from '@/types/sales'

type SalesDashboardFilters = {
  search?: string
  branchId?: string
}

function buildQuery(filters: SalesDashboardFilters) {
  const searchParams = new URLSearchParams()

  if (filters.search?.trim()) {
    searchParams.set('search', filters.search.trim())
  }

  if (filters.branchId) {
    searchParams.set('branchId', filters.branchId)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const salesService = {
  getDashboard(accessToken: string, filters: SalesDashboardFilters = {}) {
    return apiRequest<SalesDashboardResponse>(`/api/sales/dashboard${buildQuery(filters)}`, {
      accessToken,
    })
  },

  create(accessToken: string, payload: CreateSalePayload) {
    return apiRequest<{
      item: {
        id: string
        code: string
        customerName: string
        cashierName: string
        totalAmount: number
        paidAmount: number
        changeAmount: number
        outstandingAmount: number
        status: 'EMITIDA' | 'COBRADA'
      }
    }>('/api/sales', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },
}
