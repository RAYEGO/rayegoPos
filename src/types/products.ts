export type ProductStatus = 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO'

export type ProductCatalogItem = {
  id: string
  sku: string
  internalCode: string | null
  barcode: string | null
  name: string
  description: string | null
  concentration: string | null
  sanitaryRegistration: string | null
  status: ProductStatus
  requiresPrescription: boolean
  isControlled: boolean
  salePrice: number
  costPrice: number
  marginReference: number
  observations: string | null
  category: string
  categoryId: string
  laboratory: string | null
  laboratoryId: string | null
  laboratoryCountry: string | null
  presentation: string | null
  presentationId: string | null
  unit: string
  unitSymbol: string
  unitId: string
  activePrinciples: Array<{
    id: string
    name: string
    concentration: string | null
  }>
  stockUnits: number
  reservedUnits: number
  lotCount: number
  branchCoverage: number
  nextExpiry: string | null
}

export type ProductCatalogResponse = {
  items: ProductCatalogItem[]
  summary: {
    total: number
    activeCatalog: number
    lowStockCount: number
    withPrescription: number
    lotEnabled: number
  }
}

export type ProductOptionsResponse = {
  categories: Array<{
    id: string
    parentId: string | null
    code: string
    name: string
    color: string | null
    activeCount: number
    skuCount: number
    childCount: number
  }>
  laboratories: Array<{
    id: string
    name: string
    country: string | null
    skuCount: number
  }>
  presentations: Array<{
    id: string
    name: string
  }>
  units: Array<{
    id: string
    code: string
    name: string
    symbol: string
  }>
  activePrinciples: Array<{
    id: string
    name: string
    productCount: number
  }>
}

export type MasterCategoryRecord = {
  id: string
  parentId: string | null
  codigo: string
  nombre: string
  descripcion: string | null
  color: string | null
  orden: number
  activo: boolean
  productCount: number
  childCount: number
  createdAt: string
  updatedAt: string
}

export type MasterCategoriesResponse = {
  rows: MasterCategoryRecord[]
}

export type UpsertMasterCategoryPayload = {
  parentId?: string | null
  codigo: string
  nombre: string
  descripcion?: string
  color?: string
  orden?: number
  activo?: boolean
}

export type MasterLaboratoryRecord = {
  id: string
  nombre: string
  pais: string | null
  descripcion: string | null
  activo: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type MasterLaboratoriesResponse = {
  rows: MasterLaboratoryRecord[]
}

export type UpsertMasterLaboratoryPayload = {
  nombre: string
  pais?: string
  descripcion?: string
  activo?: boolean
}

export type MasterPresentationRecord = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type MasterPresentationsResponse = {
  rows: MasterPresentationRecord[]
}

export type UpsertMasterPresentationPayload = {
  nombre: string
  descripcion?: string
  activo?: boolean
}

export type MasterUnitRecord = {
  id: string
  codigo: string
  nombre: string
  simbolo: string
  descripcion: string | null
  activo: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type MasterUnitsResponse = {
  rows: MasterUnitRecord[]
}

export type UpsertMasterUnitPayload = {
  codigo: string
  nombre: string
  simbolo: string
  descripcion?: string
  activo?: boolean
}

export type CreateProductPayload = {
  categoriaId: string
  laboratorioId?: string
  presentacionId?: string
  unidadMedidaId: string
  principioActivoId?: string
  sku: string
  codigoInterno?: string
  codigoBarras?: string
  nombre: string
  descripcion?: string
  concentracion?: string
  registroSanitario?: string
  requiereReceta: boolean
  esControlado: boolean
  precioVenta: number
  costoReferencia: number
  observaciones?: string
}
