import { apiRequest } from '@/services/apiClient'
import type {
  CashierReportResponse,
  InventoryReportResponse,
  PlaceholderReportResponse,
  PurchasesReportResponse,
  SalesReportResponse,
} from '@/types/reports'

type ReportsOverviewFilters = {
  branchId?: string
  from?: string
  to?: string
}

function buildQuery(filters: ReportsOverviewFilters) {
  const searchParams = new URLSearchParams()

  if (filters.branchId) {
    searchParams.set('branchId', filters.branchId)
  }

  if (filters.from) {
    searchParams.set('from', filters.from)
  }

  if (filters.to) {
    searchParams.set('to', filters.to)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const reportsService = {
  getSales(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<SalesReportResponse>(`/api/reports/sales${buildQuery(filters)}`, {
      accessToken,
    })
  },

  getPurchases(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<PurchasesReportResponse>(`/api/reports/purchases${buildQuery(filters)}`, {
      accessToken,
    })
  },

  getInventory(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<InventoryReportResponse>(`/api/reports/inventory${buildQuery(filters)}`, {
      accessToken,
    })
  },

  getCashier(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<CashierReportResponse>(`/api/reports/cashier${buildQuery(filters)}`, {
      accessToken,
    })
  },

  getCustomers(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<PlaceholderReportResponse>(`/api/reports/customers${buildQuery(filters)}`, {
      accessToken,
    })
  },

  getProducts(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<PlaceholderReportResponse>(`/api/reports/products${buildQuery(filters)}`, {
      accessToken,
    })
  },

  getUtilities(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<PlaceholderReportResponse>(`/api/reports/utilities${buildQuery(filters)}`, {
      accessToken,
    })
  },
}
