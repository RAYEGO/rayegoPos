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
    packagingMode: 'SIMPLE' | 'BLISTER'
    unitsPerBlister: number | null
    blistersPerBox: number | null
    blisterPrice: number | null
    availableUnits: number
    availableBlisters: number | null
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
    empaque?: 'UNIDAD' | 'BLISTER' | 'CAJA'
    descuentoTotal?: number
  }>
  payments: Array<{
    formaPagoId: string
    monto: number
    referenciaExterna?: string
    observaciones?: string
  }>
}

export type SaleReceiptResponse = {
  document: {
    tipoComprobante: 'TICKET' | 'BOLETA' | 'FACTURA'
    correlativo: string
  }
  issuedAt: string | null
  company: {
    razonSocial: string
    nombreComercial: string | null
    ruc: string
    direccion: string | null
    telefono: string | null
  }
  branch: {
    id: string
    nombre: string
    direccion: string | null
    telefono: string | null
  }
  customer: {
    id: string
    nombre: string
    tipoDocumento: string | null
    numeroDocumento: string | null
    direccion: string | null
    telefono: string | null
  } | null
  cashierName: string
  items: Array<{
    id: string
    sku: string
    name: string
    unitSymbol: string
    quantity: number
    unitPrice: number
    discountAmount: number
    subtotal: number
    total: number
  }>
  totals: {
    subtotal: number
    discountTotal: number
    taxTotal: number
    total: number
    changeAmount: number
    outstandingAmount: number
  }
  payments: Array<{
    id: string
    methodCode: string
    methodName: string
    amount: number
    reference: string | null
    observations: string | null
  }>
  observations: string | null
}
