import { apiRequest } from '@/services/apiClient'
import type { ReportsOverviewResponse } from '@/types/reports'

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
  getOverview(accessToken: string, filters: ReportsOverviewFilters = {}) {
    return apiRequest<ReportsOverviewResponse>(
      `/api/reports/overview${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },
}

