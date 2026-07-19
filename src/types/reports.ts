export type BranchOption = {
  id: string
  nombre: string
  codigo: string
}

export type ReportsCategory =
  | 'VENTAS'
  | 'COMPRAS'
  | 'INVENTARIO'
  | 'CAJA'
  | 'CLIENTES'
  | 'PRODUCTOS'
  | 'UTILIDADES'

export type SalesByDayRow = {
  date: string
  total: number
  operations: number
}

export type SalesByPaymentMethodRow = {
  method: string
  amount: number
  operations: number
}

export type SaleRecentRow = {
  id: string
  document: string | null
  receiptType: string
  issuedAt: string
  customerName: string | null
  itemCount: number
  total: number
}

export type SalesReportResponse = {
  period: { from: string; to: string }
  summary: {
    salesTotal: number
    salesCount: number
    averageTicket: number
  }
  charts: {
    byDay: SalesByDayRow[]
    byPaymentMethod: SalesByPaymentMethodRow[]
  }
  recent: SaleRecentRow[]
  options: { branches: BranchOption[] }
}

export type PurchaseReportRow = {
  id: string
  issuedAt: string
  supplierName: string
  supplierDocument: string
  total: number
  pending: number
  status: string
}

export type PurchasesReportResponse = {
  period: { from: string; to: string }
  summary: {
    purchasesTotal: number
    purchasesCount: number
    purchasesOutstanding: number
  }
  rows: PurchaseReportRow[]
  options: { branches: BranchOption[] }
}

export type ExpiringLotRow = {
  id: string
  branchName: string
  productName: string
  sku: string
  lotCode: string
  availableUnits: number
  unitSymbol: string
  expiryDate: string
}

export type LowStockProductRow = {
  productId: string
  sku: string
  name: string
  unitSymbol: string
  stockUnits: number
  threshold: number
}

export type InventoryReportResponse = {
  horizon: {
    until: string
    days: number
  }
  summary: {
    expiringLotsCount: number
    lowStockProductsCount: number
  }
  rows: {
    expiringLots: ExpiringLotRow[]
    lowStockProducts: LowStockProductRow[]
  }
  options: { branches: BranchOption[] }
}

export type CashierByPaymentMethodRow = {
  method: string
  inflows: number
  outflows: number
  net: number
}

export type CashierOpeningRow = {
  id: string
  openedAt: string
  status: string
  cashDrawerCode: string
  branchName: string
  cashierName: string
  openingCash: number
  countedCash: number | null
  differenceCash: number | null
}

export type CashierCashCountRow = {
  id: string
  openingId: string
  createdAt: string
  branchName: string
  cashDrawerCode: string
  cashierName: string
  actorName: string
  expectedCashAmount: number
  countedCashAmount: number
  differenceCashAmount: number
  observations: string | null
}

export type CashierReportResponse = {
  period: { from: string; to: string }
  summary: {
    inflows: number
    outflows: number
    net: number
    openingsCount: number
    cashCountsCount: number
  }
  rows: {
    byPaymentMethod: CashierByPaymentMethodRow[]
    openings: CashierOpeningRow[]
    cashCounts: CashierCashCountRow[]
  }
  options: { branches: BranchOption[] }
}

export type PlaceholderReportResponse = {
  summary: {
    enabled: boolean
  }
  rows: unknown[]
  options: { branches: BranchOption[] }
}
