import { apiRequest } from '@/services/apiClient'
import type {
  CreateProductPayload,
  MasterCategoriesResponse,
  MasterLaboratoriesResponse,
  MasterPresentationsResponse,
  MasterUnitsResponse,
  ProductCatalogResponse,
  ProductOptionsResponse,
  UpsertMasterCategoryPayload,
  UpsertMasterLaboratoryPayload,
  UpsertMasterPresentationPayload,
  UpsertMasterUnitPayload,
} from '@/types/products'

type ListProductsFilters = {
  search?: string
  status?: 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO'
  categoryId?: string
}

function buildQuery(filters: ListProductsFilters) {
  const searchParams = new URLSearchParams()

  if (filters.search?.trim()) {
    searchParams.set('search', filters.search.trim())
  }

  if (filters.status) {
    searchParams.set('status', filters.status)
  }

  if (filters.categoryId) {
    searchParams.set('categoryId', filters.categoryId)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const productsService = {
  list(accessToken: string, filters: ListProductsFilters = {}) {
    return apiRequest<ProductCatalogResponse>(
      `/api/products${buildQuery(filters)}`,
      {
        accessToken,
      },
    )
  },

  getOptions(accessToken: string) {
    return apiRequest<ProductOptionsResponse>('/api/products/options', {
      accessToken,
    })
  },

  create(accessToken: string, payload: CreateProductPayload) {
    return apiRequest<{ item: ProductCatalogResponse['items'][number] }>(
      '/api/products',
      {
        method: 'POST',
        accessToken,
        body: payload,
      },
    )
  },

  listMasterCategories(accessToken: string) {
    return apiRequest<MasterCategoriesResponse>('/api/products/masters/categories', {
      accessToken,
    })
  },

  createMasterCategory(accessToken: string, payload: UpsertMasterCategoryPayload) {
    return apiRequest<{ success: boolean; id: string }>('/api/products/masters/categories', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  updateMasterCategory(accessToken: string, id: string, payload: UpsertMasterCategoryPayload) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/categories/${id}`, {
      method: 'PATCH',
      accessToken,
      body: payload,
    })
  },

  deleteMasterCategory(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/categories/${id}`, {
      method: 'DELETE',
      accessToken,
    })
  },

  listMasterLaboratories(accessToken: string) {
    return apiRequest<MasterLaboratoriesResponse>('/api/products/masters/laboratories', {
      accessToken,
    })
  },

  createMasterLaboratory(accessToken: string, payload: UpsertMasterLaboratoryPayload) {
    return apiRequest<{ success: boolean; id: string }>('/api/products/masters/laboratories', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  updateMasterLaboratory(accessToken: string, id: string, payload: UpsertMasterLaboratoryPayload) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/laboratories/${id}`, {
      method: 'PATCH',
      accessToken,
      body: payload,
    })
  },

  deleteMasterLaboratory(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/laboratories/${id}`, {
      method: 'DELETE',
      accessToken,
    })
  },

  listMasterPresentations(accessToken: string) {
    return apiRequest<MasterPresentationsResponse>('/api/products/masters/presentations', {
      accessToken,
    })
  },

  createMasterPresentation(accessToken: string, payload: UpsertMasterPresentationPayload) {
    return apiRequest<{ success: boolean; id: string }>('/api/products/masters/presentations', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  updateMasterPresentation(accessToken: string, id: string, payload: UpsertMasterPresentationPayload) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/presentations/${id}`, {
      method: 'PATCH',
      accessToken,
      body: payload,
    })
  },

  deleteMasterPresentation(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/presentations/${id}`, {
      method: 'DELETE',
      accessToken,
    })
  },

  listMasterUnits(accessToken: string) {
    return apiRequest<MasterUnitsResponse>('/api/products/masters/units', {
      accessToken,
    })
  },

  createMasterUnit(accessToken: string, payload: UpsertMasterUnitPayload) {
    return apiRequest<{ success: boolean; id: string }>('/api/products/masters/units', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  updateMasterUnit(accessToken: string, id: string, payload: UpsertMasterUnitPayload) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/units/${id}`, {
      method: 'PATCH',
      accessToken,
      body: payload,
    })
  },

  deleteMasterUnit(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/units/${id}`, {
      method: 'DELETE',
      accessToken,
    })
  },
}
