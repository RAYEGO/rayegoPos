export type InitialInventoryLoadRow = {
  id: string
  createdAt: string
  branchName: string
  productsLoaded: number
  lotsCreated: number
  responsibleName: string
  status: string
}

export type ListInitialInventoryLoadsResponse = {
  rows: InitialInventoryLoadRow[]
}

export type CreateInitialInventoryLoadPayload = {
  items: Array<{
    productoId: string
    presentacionId?: string
    numeroLote: string
    fechaVencimiento: string
    costoUnitario: number
    cantidad: number
  }>
}

export type CreateInitialInventoryLoadResponse = {
  item: InitialInventoryLoadRow
}

export type PurgeTestDataPayload = {
  confirmText: string
}

export type PurgeTestDataResponse = {
  success: true
  deleted: Record<string, number>
}
