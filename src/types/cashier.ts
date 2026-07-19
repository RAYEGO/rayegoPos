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
  openingId: string
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

export type CashReconciliationRow = {
  paymentMethodId: string
  code: 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'OTRO'
  name: string
  expectedAmount: number
  countedAmount: number
  differenceAmount: number
}

export type CashReconciliationPreviewResponse = {
  opening: {
    id: string
    branchName: string
    cashDrawerCode: string
    openedAt: string | null
  }
  rows: CashReconciliationRow[]
  totals: {
    expectedAmount: number
    countedAmount: number
    differenceAmount: number
  }
  lastSaved: {
    id: string
    createdAt: string | null
    observations: string | null
  } | null
  history: Array<{
    id: string
    createdAt: string | null
    expectedAmount: number
    countedAmount: number
    differenceAmount: number
    observations: string | null
    actorName: string
  }>
}

export type SaveCashReconciliationPayload = {
  openingId: string
  counted: Record<string, number>
  observations?: string
}

export type SaveCashReconciliationResponse = {
  success: boolean
  reconciliationId: string
  totals: {
    expectedAmount: number
    countedAmount: number
    differenceAmount: number
  }
}

export type CreateCashCountPayload = {
  openingId: string
  countedCashAmount: number
  observations?: string
}

export type CreateCashCountResponse = {
  success: boolean
  cashCountId: string
  createdAt: string | null
  expectedCashAmount: number
  countedCashAmount: number
  differenceCashAmount: number
}

export type CashCountRecord = {
  id: string
  createdAt: string | null
  expectedCashAmount: number
  countedCashAmount: number
  differenceCashAmount: number
  observations: string | null
  actorName: string
}

export type CashCountsResponse = {
  openingId: string
  rows: CashCountRecord[]
}

export interface BranchOption {
  id: string
  nombre: string
  codigo: string
}

export interface CashierDashboardOptions {
  branches: BranchOption[]
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
  options: CashierDashboardOptions
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
