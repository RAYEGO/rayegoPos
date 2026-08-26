import { apiRequest } from '@/services/apiClient'
import type {
  CreateProductPayload,
  MasterCategoriesResponse,
  MasterActivePrinciplesResponse,
  MasterCommercialTypesResponse,
  MasterLaboratoriesResponse,
  MasterPresentationsResponse,
  MasterUnitsResponse,
  ProductCatalogResponse,
  ProductOptionsResponse,
  ProductPackagingPreviewPayload,
  ProductPackagingPreviewResponse,
  ProductStatus,
  UpdateProductPayload,
  UpsertMasterActivePrinciplePayload,
  UpsertMasterCategoryPayload,
  UpsertMasterCommercialTypePayload,
  UpsertMasterLaboratoryPayload,
  UpsertMasterPresentationPayload,
  UpsertMasterUnitPayload,
} from '@/types/products'

type ListProductsFilters = {
  search?: string
  status?: 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO'
  categoryId?: string
  laboratoryId?: string
  commercialTypeId?: string
  activePrincipleId?: string
  medicationTypeId?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'stockUnits' | 'createdAt'
  sortDir?: 'asc' | 'desc'
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

  if (filters.laboratoryId) {
    searchParams.set('laboratoryId', filters.laboratoryId)
  }

  if (filters.commercialTypeId) {
    searchParams.set('commercialTypeId', filters.commercialTypeId)
  } else if (filters.medicationTypeId) {
    searchParams.set('commercialTypeId', filters.medicationTypeId)
  }

  if (filters.activePrincipleId) {
    searchParams.set('activePrincipleId', filters.activePrincipleId)
  }

  if (typeof filters.page === 'number' && Number.isFinite(filters.page)) {
    searchParams.set('page', String(filters.page))
  }

  if (typeof filters.pageSize === 'number' && Number.isFinite(filters.pageSize)) {
    searchParams.set('pageSize', String(filters.pageSize))
  }

  if (filters.sortBy) {
    searchParams.set('sortBy', filters.sortBy)
  }

  if (filters.sortDir) {
    searchParams.set('sortDir', filters.sortDir)
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

  previewPackaging(accessToken: string, payload: ProductPackagingPreviewPayload) {
    return apiRequest<ProductPackagingPreviewResponse>('/api/products/packaging/preview', {
      method: 'POST',
      accessToken,
      body: payload,
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

  update(accessToken: string, id: string, payload: UpdateProductPayload) {
    return apiRequest<{ item: ProductCatalogResponse['items'][number] }>(
      `/api/products/${id}`,
      {
        method: 'PATCH',
        accessToken,
        body: payload,
      },
    )
  },

  updateStatus(accessToken: string, id: string, status: ProductStatus) {
    return apiRequest<{ success: boolean }>(`/api/products/${id}/status`, {
      method: 'PATCH',
      accessToken,
      body: { status },
    })
  },

  delete(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/${id}`, {
      method: 'DELETE',
      accessToken,
    })
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

  listMasterCommercialTypes(accessToken: string) {
    return apiRequest<MasterCommercialTypesResponse>('/api/products/masters/commercial-types', {
      accessToken,
    })
  },

  listMasterMedicationTypes(accessToken: string) {
    return productsService.listMasterCommercialTypes(accessToken)
  },

  createMasterCommercialType(accessToken: string, payload: UpsertMasterCommercialTypePayload) {
    return apiRequest<{ success: boolean; id: string }>('/api/products/masters/commercial-types', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  createMasterMedicationType(accessToken: string, payload: UpsertMasterCommercialTypePayload) {
    return productsService.createMasterCommercialType(accessToken, payload)
  },

  updateMasterCommercialType(
    accessToken: string,
    id: string,
    payload: UpsertMasterCommercialTypePayload,
  ) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/commercial-types/${id}`, {
      method: 'PATCH',
      accessToken,
      body: payload,
    })
  },

  updateMasterMedicationType(
    accessToken: string,
    id: string,
    payload: UpsertMasterCommercialTypePayload,
  ) {
    return productsService.updateMasterCommercialType(accessToken, id, payload)
  },

  deleteMasterCommercialType(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/commercial-types/${id}`, {
      method: 'DELETE',
      accessToken,
    })
  },

  deleteMasterMedicationType(accessToken: string, id: string) {
    return productsService.deleteMasterCommercialType(accessToken, id)
  },

  listMasterActivePrinciples(accessToken: string) {
    return apiRequest<MasterActivePrinciplesResponse>('/api/products/masters/active-principles', {
      accessToken,
    })
  },

  createMasterActivePrinciple(accessToken: string, payload: UpsertMasterActivePrinciplePayload) {
    return apiRequest<{ success: boolean; id: string }>('/api/products/masters/active-principles', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  updateMasterActivePrinciple(
    accessToken: string,
    id: string,
    payload: UpsertMasterActivePrinciplePayload,
  ) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/active-principles/${id}`, {
      method: 'PATCH',
      accessToken,
      body: payload,
    })
  },

  deleteMasterActivePrinciple(accessToken: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/products/masters/active-principles/${id}`, {
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
