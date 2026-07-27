import { apiRequest } from '@/services/apiClient'
import type { CompanyProfile, UpdateCompanyProfilePayload } from '@/types/company'

export const companyService = {
  getProfile(accessToken: string) {
    return apiRequest<{ company: CompanyProfile }>('/api/settings/company', {
      accessToken,
    })
  },

  updateProfile(accessToken: string, payload: UpdateCompanyProfilePayload) {
    return apiRequest<{ company: CompanyProfile }>('/api/settings/company', {
      method: 'PUT',
      accessToken,
      body: payload,
    })
  },
}

