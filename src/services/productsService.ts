import { apiRequest } from '@/services/apiClient'
import type {
  CreateProductPayload,
  ProductCatalogResponse,
  ProductOptionsResponse,
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
}
