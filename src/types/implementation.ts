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
    numeroLote: string
    fechaVencimiento: string
    costoUnitario: number
    empaque: 'UNIDAD' | 'BLISTER' | 'CAJA'
    cantidad: number
  }>
}

export type CreateInitialInventoryLoadResponse = {
  item: InitialInventoryLoadRow
}
