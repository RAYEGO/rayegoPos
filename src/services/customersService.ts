import { apiRequest } from '@/services/apiClient'
import type {
  CreateCustomerPayload,
  CustomerStatusFilter,
  CustomersDashboardResponse,
  UpdateCustomerPayload,
} from '@/types/customers'

type CustomersDashboardFilters = {
  search?: string
  status?: CustomerStatusFilter
}

function buildQuery(filters: CustomersDashboardFilters) {
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

export const customersService = {
  getDashboard(accessToken: string, filters: CustomersDashboardFilters = {}) {
    return apiRequest<CustomersDashboardResponse>(
      `/api/customers${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },

  create(accessToken: string, payload: CreateCustomerPayload) {
    return apiRequest<{ item: CustomersDashboardResponse['customers'][number] }>(
      '/api/customers',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  update(accessToken: string, customerId: string, payload: UpdateCustomerPayload) {
    return apiRequest<{ item: CustomersDashboardResponse['customers'][number] }>(
      `/api/customers/${customerId}`,
      {
        method: 'PUT',
        accessToken,
        body: payload,
      },
    )
  },

  remove(accessToken: string, customerId: string) {
    return apiRequest<{ success: boolean }>(`/api/customers/${customerId}`, {
      method: 'DELETE',
      accessToken,
    })
  },
}

