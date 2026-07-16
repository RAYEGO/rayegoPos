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
    returnedAmount: number
    netSpend: number
    totalPaid: number
    pendingPayables: number
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
    adjustedPendingAmount: number
    returnedAmount: number
    netAmount: number
    paidAmount: number
    paymentCount: number
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
    lotId: string | null
    lotCode: string
    receivedUnits: number
    orderedUnits: number
    pendingUnits: number
    returnedUnits: number
    returnedAmount: number
    availableUnits: number
    reservedUnits: number
    blockedUnits: number
    expiryDate: string | null
    branchId: string
    branchName: string
    coldChain: boolean
    status: PurchaseReceiptStatus
  }>
  payments: Array<{
    id: string
    purchaseId: string
    purchaseCode: string
    supplierName: string
    formPaymentId: string
    formPaymentCode: string
    formPaymentName: string
    amount: number
    paidAt: string | null
    reference: string | null
    observations: string | null
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
    paymentMethods: Array<{
      id: string
      code: string
      name: string
      requiresReference: boolean
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

export type ReceivePurchaseItemPayload = {
  detalleCompraId: string
  numeroLote: string
  fechaFabricacion?: string
  fechaVencimiento: string
  cantidadRecibida: number
  stockReservado?: number
  stockBloqueado?: number
  almacen?: string
  observaciones?: string
}

export type ReturnPurchaseItemPayload = {
  lotId: string
  target: 'DISPONIBLE' | 'RESERVADO' | 'BLOQUEADO'
  quantity: number
  observaciones?: string
}

export type RegisterPurchasePaymentPayload = {
  compraId: string
  formaPagoId: string
  monto: number
  fechaPago?: string
  referenciaExterna?: string
  observaciones?: string
}
