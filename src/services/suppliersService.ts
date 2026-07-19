import { apiRequest } from '@/services/apiClient'
import type {
  CreateSupplierPayload,
  SupplierStatusFilter,
  SuppliersDashboardResponse,
  UpdateSupplierPayload,
} from '@/types/suppliers'

type SuppliersDashboardFilters = {
  search?: string
  status?: SupplierStatusFilter
}

function buildQuery(filters: SuppliersDashboardFilters) {
  const searchParams = new URLSearchParams()

  if (filters.search?.trim()) {
    searchParams.set('search', filters.search.trim())
  }

  if (filters.status) {
    searchParams.set('status', filters.status)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const suppliersService = {
  getDashboard(accessToken: string, filters: SuppliersDashboardFilters = {}) {
    return apiRequest<SuppliersDashboardResponse>(
      `/api/suppliers${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },

  create(accessToken: string, payload: CreateSupplierPayload) {
    return apiRequest<{ item: SuppliersDashboardResponse['suppliers'][number] }>(
      '/api/suppliers',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  update(accessToken: string, supplierId: string, payload: UpdateSupplierPayload) {
    return apiRequest<{ item: SuppliersDashboardResponse['suppliers'][number] }>(
      `/api/suppliers/${supplierId}`,
      {
        method: 'PUT',
        accessToken,
        body: payload,
      },
    )
  },

  remove(accessToken: string, supplierId: string) {
    return apiRequest<{ success: boolean }>(`/api/suppliers/${supplierId}`, {
      method: 'DELETE',
      accessToken,
    })
  },
}
