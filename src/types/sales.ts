export type SaleStatus = 'BORRADOR' | 'EMITIDA' | 'COBRADA' | 'ANULADA'

export type SalesDashboardResponse = {
  summary: {
    recentSalesCount: number
    issuedSalesCount: number
    paidSalesCount: number
    pendingSalesCount: number
    totalBilledAmount: number
    totalOutstandingAmount: number
    prescriptionItemsCount: number
    controlledItemsCount: number
  }
  products: Array<{
    id: string
    name: string
    sku: string
    categoryName: string
    presentationName: string
    unitSymbol: string
    salePrice: number
    availableUnits: number
    requiresPrescription: boolean
    isControlled: boolean
    coldChain: boolean
    suggestedLot: {
      id: string
      branchId: string
      lotCode: string
      expiryDate: string | null
      availableUnits: number
      reservedUnits: number
      blockedUnits: number
    } | null
  }>
  recentSales: Array<{
    id: string
    code: string
    customerName: string
    cashierName: string
    branchId: string
    branchName: string
    createdAt: string | null
    totalAmount: number
    outstandingAmount: number
    paymentMethods: Array<'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'OTRO'>
    itemCount: number
    status: SaleStatus
  }>
  dispensations: Array<{
    id: string
    saleId: string
    saleCode: string
    productName: string
    customerName: string
    cashierName: string
    dispensedAt: string | null
    lotCodes: string[]
    requiresPrescription: boolean
    isControlled: boolean
    status: 'VALIDADA'
  }>
  options: {
    branches: Array<{
      id: string
      name: string
    }>
    customers: Array<{
      id: string
      name: string
      documentNumber: string | null
    }>
    paymentMethods: Array<{
      id: string
      code: 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'OTRO'
      name: string
      requiresReference: boolean
      allowsChange: boolean
    }>
  }
}

export type CreateSalePayload = {
  sucursalId: string
  clienteId?: string
  tipoComprobante?: 'TICKET' | 'BOLETA' | 'FACTURA'
  observaciones?: string
  items: Array<{
    productoId: string
    cantidad: number
    descuentoTotal?: number
  }>
  payments: Array<{
    formaPagoId: string
    monto: number
    referenciaExterna?: string
    observaciones?: string
  }>
}
