import type { CategoryRecord, CategoryStatsSnapshot } from './types'
import { generateMasterCodeFromName, normalizeMasterKey } from '@/utils/masterCatalog'

export function normalizeCategoryKey(value: string) {
  return normalizeMasterKey(value)
}

export function generateCategoryCodeFromName(name: string) {
  return generateMasterCodeFromName(name, 'CATEGORIA', 30)
}

export function getCategoryStats(records: CategoryRecord[]): CategoryStatsSnapshot {
  const totalCount = records.length
  const activeCount = records.filter((record) => record.active).length
  const inactiveCount = totalCount - activeCount
  const productCount = records.reduce((sum, record) => sum + record.productCount, 0)

  return {
    totalCount,
    activeCount,
    inactiveCount,
    productCount,
  }
}
