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
  commercialType: string | null
  commercialTypeId: string | null
  medicationType: string | null
  medicationTypeId: string | null
  presentation: string | null
  presentationId: string | null
  unit: string
  unitSymbol: string
  unitId: string
  packaging: {
    basePresentationId: string | null
    purchasePresentationId: string | null
    presentations: Array<{
      id: string
      name: string
      isBase: boolean
      allowsPurchase: boolean
      allowsSale: boolean
      salePrice: number | null
      factorToBase: number | null
    }>
    conversions: Array<{
      id: string
      fromPresentationId: string
      toPresentationId: string
      quantity: number
    }>
  }
  activePrinciple: string | null
  activePrincipleId: string | null
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
  canDelete: boolean
}

export type ProductPackagingPresentationInput = {
  presentacionId: string
  permiteCompra: boolean
  permiteVenta: boolean
  precioVenta?: number
}

export type ProductPackagingConversionInput = {
  desdePresentacionId: string
  haciaPresentacionId: string
  cantidad: number
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
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  sort: {
    by: 'name' | 'stockUnits' | 'createdAt'
    dir: 'asc' | 'desc'
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
  commercialTypes: Array<{
    id: string
    name: string
    skuCount: number
  }>
  medicationTypes: Array<{
    id: string
    name: string
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
  codigo?: string
  nombre: string
  descripcion?: string
  color?: string
  orden?: number
  activo?: boolean
}

export type MasterLaboratoryRecord = {
  id: string
  codigo: string
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

export type MasterCommercialTypeRecord = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  activo: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type MasterCommercialTypesResponse = {
  rows: MasterCommercialTypeRecord[]
}

export type UpsertMasterCommercialTypePayload = {
  nombre: string
  descripcion?: string
  activo?: boolean
}

export type MasterMedicationTypeRecord = MasterCommercialTypeRecord
export type MasterMedicationTypesResponse = MasterCommercialTypesResponse
export type UpsertMasterMedicationTypePayload = UpsertMasterCommercialTypePayload

export type MasterActivePrincipleRecord = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  activo: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type MasterActivePrinciplesResponse = {
  rows: MasterActivePrincipleRecord[]
}

export type UpsertMasterActivePrinciplePayload = {
  nombre: string
  descripcion?: string
  activo?: boolean
}

export type MasterPresentationRecord = {
  id: string
  codigo: string
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
  codigo?: string
  nombre: string
  simbolo: string
  descripcion?: string
  activo?: boolean
}

export type CreateProductPayload = {
  categoriaId: string
  laboratorioId?: string
  tipoComercialId: string
  presentacionId?: string
  unidadMedidaId: string
  compraPresentacionId: string
  basePresentacionId: string
  presentacionesEmpaque: ProductPackagingPresentationInput[]
  conversionesEmpaque?: ProductPackagingConversionInput[]
  principioActivoId: string
  sku: string
  codigoBarras?: string
  nombre: string
  descripcion?: string
  concentracion?: string
  registroSanitario?: string
  requiereReceta: boolean
  esControlado: boolean
  costoReferencia: number
  observaciones?: string
}

export type UpdateProductPayload = CreateProductPayload
