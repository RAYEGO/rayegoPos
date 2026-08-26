import type {
  PaymentCategory as SharedPaymentCategory,
  DigitalSubmethod as SharedDigitalSubmethod,
} from '@/lib/payment-methods'

export type CashDrawerStatus = 'ABIERTA' | 'EN_CIERRE' | 'CERRADA'

export type CashMovementType =
  | 'VENTA'
  | 'INGRESO_MANUAL'
  | 'EGRESO'
  | 'RETIRO'
  | 'CUADRE'

export type PaymentMethodCode =
  | 'EFECTIVO'
  | 'TARJETA'
  | 'YAPE'
  | 'PLIN'
  | 'TRANSFERENCIA'
  | 'OTRO'

export type PaymentCategory = SharedPaymentCategory
export type DigitalSubmethod = SharedDigitalSubmethod

export type CashDrawerBalanceByMethod = {
  paymentMethodId: string
  code: PaymentMethodCode
  name: string
  expectedAmount: number
  openingBase: number
  income: number
  expense: number
}

export type CashDrawerRecord = {
  id: string
  name: string
  code: string
  branchName: string
  cashierName: string
  openedAt: string | null
  openingAmount: number
  expectedAmount: number
  countedAmount: number
  differenceAmount: number
  status: CashDrawerStatus
  closePending: boolean
  balances: CashDrawerBalanceByMethod[]
}

export type CashMovementRecord = {
  id: string
  openingId: string
  createdAt: string | null
  type: CashMovementType
  description: string
  reference: string
  paymentMethod: PaymentMethodCode | 'INTERNO'
  amount: number
  actorName: string
}

export type CashPaymentSummaryRecord = {
  method: PaymentMethodCode
  salesAmount: number
  collectedAmount: number
  operations: number
}

export type CashReconciliationRow = {
  paymentMethodId: string
  code: PaymentMethodCode
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

export type ActiveCashDrawerResponse = {
  openingId: string
  openedAt: string | null
  openingAmount: number
  expectedAmount: number
}

export interface BranchOption {
  id: string
  nombre: string
  codigo: string
}

export interface CashierDashboardOptions {
  branches: BranchOption[]
  paymentMethods: Array<{
    id: string
    code: PaymentMethodCode
    name: string
    category: PaymentCategory
    digitalSubmethod: DigitalSubmethod | null
  }>
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
  branchId?: string
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
  paymentMethodId?: string
  amount: number
  concept: string
  reference?: string
  observations?: string
}
