export type CashDrawerStatus = 'ABIERTA' | 'EN_CIERRE' | 'CERRADA'

export type CashMovementType =
  | 'VENTA'
  | 'INGRESO_MANUAL'
  | 'EGRESO'
  | 'RETIRO'
  | 'CUADRE'

export type CashDrawerRecord = {
  id: string
  code: string
  branchName: string
  cashierName: string
  openedAt: string | null
  openingAmount: number
  expectedAmount: number
  countedAmount: number
  differenceAmount: number
  status: CashDrawerStatus
}

export type CashMovementRecord = {
  id: string
  createdAt: string | null
  type: CashMovementType
  description: string
  reference: string
  paymentMethod:
    | 'EFECTIVO'
    | 'TARJETA'
    | 'YAPE'
    | 'PLIN'
    | 'TRANSFERENCIA'
    | 'OTRO'
    | 'INTERNO'
  amount: number
  actorName: string
}

export type CashPaymentSummaryRecord = {
  method: 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'OTRO'
  salesAmount: number
  collectedAmount: number
  operations: number
}

export type CashierDashboardResponse = {
  cashDrawers: CashDrawerRecord[]
  cashMovements: CashMovementRecord[]
  cashPaymentSummary: CashPaymentSummaryRecord[]
  dashboardTotals: {
    totalSales: number
    totalInternalMovements: number
    pendingCollections: number
  }
}

export type OpenCashDrawerPayload = {
  branchId: string
  openingAmount: number
  observations?: string
}

export type CloseCashDrawerPayload = {
  openingId: string
  countedAmount: number
  observations?: string
}

export type CreateCashMovementPayload = {
  openingId: string
  type: 'INGRESO' | 'EGRESO'
  amount: number
  concept: string
  reference?: string
  observations?: string
}
