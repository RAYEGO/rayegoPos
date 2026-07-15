export type PurchaseOrderStatus =
  | 'BORRADOR'
  | 'REGISTRADA'
  | 'PARCIAL'
  | 'PAGADA'
  | 'ANULADA'

export type PurchaseReceiptStatus = 'PROGRAMADA' | 'RECIBIDA' | 'OBSERVADA'

export type PurchasesDashboardResponse = {
  summary: {
    totalOrders: number
    activeOrders: number
    scheduledReceipts: number
    observedReceipts: number
    activeSpend: number
    supplierCount: number
  }
  orders: Array<{
    id: string
    code: string
    supplierId: string
    supplierName: string
    supplierDocument: string
    branchId: string
    branchName: string
    buyerId: string
    buyerName: string
    createdAt: string | null
    expectedAt: string | null
    itemCount: number
    totalAmount: number
    subtotalAmount: number
    taxAmount: number
    pendingAmount: number
    status: PurchaseOrderStatus
    observations: string | null
  }>
  receipts: Array<{
    id: string
    purchaseId: string
    purchaseCode: string
    productId: string
    productName: string
    supplierName: string
    receivedAt: string | null
    lotCode: string
    receivedUnits: number
    orderedUnits: number
    expiryDate: string | null
    branchId: string
    branchName: string
    coldChain: boolean
    status: PurchaseReceiptStatus
  }>
  supplierSummary: Array<{
    supplierId: string
    supplierName: string
    documentNumber: string
    contactPhone: string | null
    activeOrders: number
    avgLeadTimeDays: number
    serviceLevel: number
    criticalProducts: number
  }>
  options: {
    branches: Array<{
      id: string
      name: string
    }>
    suppliers: Array<{
      id: string
      name: string
      documentNumber: string
    }>
    products: Array<{
      id: string
      name: string
      sku: string
      unitSymbol: string
      referenceCost: number
    }>
  }
}

export type CreatePurchaseOrderPayload = {
  sucursalId: string
  proveedorId: string
  fechaEmision?: string
  fechaRecepcion?: string
  estado: 'BORRADOR' | 'REGISTRADA'
  observaciones?: string
  items: Array<{
    productoId: string
    cantidad: number
    costoUnitario: number
    porcentajeImpuesto?: number
  }>
}
