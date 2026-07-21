export type CategoryRecord = {
  id: string
  code: string
  name: string
  description: string
  color: string | null
  order: number
  parentId: string | null
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export type CategoryTreeNode = {
  id: string
  record: CategoryRecord
  children: CategoryTreeNode[]
}

export type CategoryStatsSnapshot = {
  rootCount: number
  subcategoryCount: number
  totalCount: number
  productCount: number
}
