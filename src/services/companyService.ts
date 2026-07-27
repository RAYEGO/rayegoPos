import { apiRequest } from '@/services/apiClient'
import type {
  CompanyProfile,
  DeleteCompanyLogoResponse,
  UpdateCompanyProfilePayload,
  UploadCompanyLogoPayload,
  UploadCompanyLogoResponse,
} from '@/types/company'

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

  uploadLogo(accessToken: string, payload: UploadCompanyLogoPayload) {
    return apiRequest<UploadCompanyLogoResponse>('/api/settings/company/logo', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  deleteLogo(accessToken: string) {
    return apiRequest<DeleteCompanyLogoResponse>('/api/settings/company/logo', {
      method: 'DELETE',
      accessToken,
    })
  },
}
