export type BranchOption = {
  id: string
  nombre: string
  codigo: string
}

export type DashboardKpis = {
  salesTodayTotal: number
  salesTodayCount: number
  averageTicket: number
  pendingCollections: number
  purchaseOpenCount: number
  purchaseOutstanding: number
  availableStockUnits: number
  expiringLotsCount: number
  lowStockProductsCount: number
  customersTotalCount: number
  customersActiveCount: number
  activeProductsCount: number
}

export type DashboardExpiringLot = {
  id: string
  branchName: string
  productName: string
  sku: string
  lotCode: string
  availableUnits: number
  unitSymbol: string
  expiryDate: string
}

export type DashboardLowStockProduct = {
  productId: string
  sku: string
  name: string
  unitSymbol: string
  stockUnits: number
  threshold: number
}

export type DashboardCustomerRanking = {
  customerId: string
  name: string
  total: number
  operations: number
}

export type DashboardRecentSale = {
  id: string
  issuedAt: string
  status: string
  document: string | null
  receiptType: string
  customerName: string | null
  total: number
}

export type DashboardCashDrawer = {
  id: string
  openedAt: string
  cashierName: string
  branchName: string
  openingAmount: number
  expectedAmount: number
  countedAmount: number
  differenceAmount: number
}

export type DashboardPaymentSummary = {
  method: string
  salesAmount: number
  collectedAmount: number
  operations: number
}

export type DashboardOverviewResponse = {
  kpis: DashboardKpis
  cashPaymentSummary: DashboardPaymentSummary[]
  alerts: {
    expiringLots: DashboardExpiringLot[]
    lowStockProducts: DashboardLowStockProduct[]
  }
  topCustomers: DashboardCustomerRanking[]
  recentSales: DashboardRecentSale[]
  cashDrawer: DashboardCashDrawer | null
  options: {
    branches: BranchOption[]
  }
}
