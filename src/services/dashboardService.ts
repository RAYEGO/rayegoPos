import { apiRequest } from '@/services/apiClient'
import type { DashboardOverviewResponse } from '@/types/dashboard'

type DashboardOverviewFilters = {
  branchId?: string
}

function buildQuery(filters: DashboardOverviewFilters) {
  const searchParams = new URLSearchParams()

  if (filters.branchId) {
    searchParams.set('branchId', filters.branchId)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const dashboardService = {
  getOverview(accessToken: string, filters: DashboardOverviewFilters = {}) {
    return apiRequest<DashboardOverviewResponse>(
      `/api/dashboard/overview${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },
}

