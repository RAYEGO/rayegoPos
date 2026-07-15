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
    name: string
    activeCount: number
    skuCount: number
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
