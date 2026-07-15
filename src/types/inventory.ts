export type InventoryLotStatus = 'ACTIVO' | 'BLOQUEADO' | 'VENCIDO' | 'AGOTADO'

export type InventoryMovementType =
  | 'ENTRADA'
  | 'SALIDA'
  | 'AJUSTE'
  | 'RESERVA'
  | 'LIBERACION'
  | 'TRANSFERENCIA'

export type InventoryDashboardResponse = {
  summary: {
    totalAvailableUnits: number
    totalReservedUnits: number
    totalBlockedUnits: number
    expiringSoonCount: number
    branchCount: number
    lotCount: number
  }
  branchSummary: Array<{
    id: string
    name: string
    warehouseNames: string[]
    skuCount: number
    lotCount: number
    availableUnits: number
    reservedUnits: number
    blockedUnits: number
    expiringSoonCount: number
  }>
  lots: Array<{
    id: string
    productId: string
    productName: string
    sku: string
    unitSymbol: string
    branchId: string
    branchName: string
    warehouseName: string
    supplierName: string
    lotCode: string
    manufacturedAt: string | null
    expiryDate: string | null
    receivedAt: string | null
    unitCost: number
    initialUnits: number
    availableUnits: number
    reservedUnits: number
    blockedUnits: number
    status: InventoryLotStatus
    observations: string | null
    expiresSoon: boolean
  }>
  movements: Array<{
    id: string
    createdAt: string | null
    type: InventoryMovementType
    origin: string
    productName: string
    sku: string
    branchName: string
    warehouseName: string
    lotCode: string
    quantity: number
    stockAfter: number
    unitCost: number
    reference: string | null
    actorName: string
  }>
  alerts: Array<{
    id: string
    productId: string
    productName: string
    sku: string
    unitSymbol: string
    branchId: string
    branchName: string
    warehouseName: string
    supplierName: string
    lotCode: string
    manufacturedAt: string | null
    expiryDate: string | null
    receivedAt: string | null
    unitCost: number
    initialUnits: number
    availableUnits: number
    reservedUnits: number
    blockedUnits: number
    status: InventoryLotStatus
    observations: string | null
    expiresSoon: boolean
    alertType: 'BLOQUEADO' | 'VENCIDO' | 'SIN_STOCK' | 'POR_VENCER'
  }>
  fifoCandidates: InventoryDashboardResponse['lots']
  options: {
    branches: Array<{
      id: string
      name: string
    }>
    products: Array<{
      id: string
      name: string
      sku: string
    }>
    suppliers: Array<{
      id: string
      name: string
    }>
    warehouses: Array<{
      branchId: string
      name: string
    }>
  }
}

export type CreateInventoryLotPayload = {
  sucursalId: string
  productoId: string
  proveedorId?: string
  numeroLote: string
  fechaFabricacion?: string
  fechaVencimiento: string
  costoUnitario: number
  stockInicial: number
  stockReservado?: number
  stockBloqueado?: number
  almacen?: string
  observaciones?: string
}

export type InventoryAdjustmentTarget = 'DISPONIBLE' | 'RESERVADO' | 'BLOQUEADO'

export type InventoryAdjustmentOperation = 'SUMAR' | 'RESTAR'

export type AdjustInventoryLotPayload = {
  lotId: string
  target: InventoryAdjustmentTarget
  operation: InventoryAdjustmentOperation
  quantity: number
  observaciones?: string
}

export type TransferInventoryLotPayload = {
  lotId: string
  destinationBranchId: string
  quantity: number
  destinationWarehouse?: string
  observaciones?: string
}
