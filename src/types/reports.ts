export type BranchOption = {
  id: string
  nombre: string
  codigo: string
}

export type ReportsSummary = {
  salesTotal: number
  salesCount: number
  averageTicket: number
  purchasesCount: number
  purchasesOutstanding: number
  expiringLotsCount: number
}

export type ReportsSaleRow = {
  id: string
  document: string | null
  receiptType: string
  issuedAt: string
  customerName: string | null
  itemCount: number
  total: number
}

export type ReportsSalesByDay = {
  date: string
  total: number
  operations: number
}

export type ReportsSalesByPaymentMethod = {
  method: string
  amount: number
  operations: number
}

export type ReportsPurchaseRow = {
  id: string
  issuedAt: string
  supplierName: string
  supplierDocument: string
  total: number
  pending: number
  status: string
}

export type ReportsExpiringLot = {
  id: string
  branchName: string
  productName: string
  sku: string
  lotCode: string
  availableUnits: number
  unitSymbol: string
  expiryDate: string
}

export type ReportsOverviewResponse = {
  period: {
    from: string
    to: string
  }
  summary: ReportsSummary
  sales: {
    recent: ReportsSaleRow[]
    byDay: ReportsSalesByDay[]
    byPaymentMethod: ReportsSalesByPaymentMethod[]
  }
  purchases: ReportsPurchaseRow[]
  inventory: {
    expiringLots: ReportsExpiringLot[]
  }
  options: {
    branches: BranchOption[]
  }
}

