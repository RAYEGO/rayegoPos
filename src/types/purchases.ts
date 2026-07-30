export type PurchaseOrderStatus =
  | 'BORRADOR'
  | 'REGISTRADA'
  | 'PARCIAL'
  | 'PAGADA'
  | 'ANULADA'

export type PurchaseLogisticsStatus =
  | 'REGISTRADA'
  | 'EN_RECEPCION'
  | 'RECEPCION_PARCIAL'
  | 'RECEPCION_COMPLETA'
  | 'CANCELADA'

export type PurchaseFinancialStatus = 'SIN_PAGAR' | 'PAGO_PARCIAL' | 'PAGADA'

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
    logisticsStatus: PurchaseLogisticsStatus
    financialStatus: PurchaseFinancialStatus
    receivedUnits: number
    receivedAmount: number
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
    presentationName: string | null
    presentationFactor: number | null
    orderedPresentationQuantity: number | null
    receivedPresentationQuantity: number | null
    pendingPresentationQuantity: number | null
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
      } | null
    }>
  }
}

export type CreatePurchaseOrderPayload = {
  sucursalId?: string
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

export type CreatePurchaseReceptionPayload = {
  compraId: string
  observaciones?: string
  items: ReceivePurchaseItemPayload[]
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
