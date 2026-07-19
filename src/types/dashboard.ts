export type BranchOption = {
  id: string
  nombre: string
  codigo: string
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
  lastCashCount: {
    createdAt: string
    expectedCashAmount: number
    countedCashAmount: number
    differenceCashAmount: number
  } | null
}

export type DashboardRecentCashMovement = {
  id: string
  createdAt: string
  type: string
  operation: string
  amount: number
  reference: string | null
  paymentMethod: string | null
  actorName: string
}

export type DashboardOverviewResponse = {
  sales: {
    todayTotal: number
    todayCount: number
    averageTicket: number
  }
  cash: {
    activeDrawer: DashboardCashDrawer | null
  }
  alerts: {
    expiringLotsCount: number
    lowStockProductsCount: number
    expiringLots: DashboardExpiringLot[]
    lowStockProducts: DashboardLowStockProduct[]
  }
  activity: {
    recentSales: DashboardRecentSale[]
    recentCashMovements: DashboardRecentCashMovement[]
  }
  options: {
    branches: BranchOption[]
  }
}
