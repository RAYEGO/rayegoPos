export type CategoryRecord = {
  id: string
  code: string
  name: string
  description: string
  color: string | null
  order: number
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type CategoryStatsSnapshot = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  productCount: number
}
