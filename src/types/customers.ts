export type CustomerStatusFilter = 'activo' | 'inactivo'

export type CustomerItem = {
  id: string
  tipoPersona: string
  tipoDocumento: string | null
  numeroDocumento: string | null
  nombres: string | null
  apellidos: string | null
  razonSocial: string | null
  nombreCompleto: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  permitirCredito: boolean
  limiteCredito: number
  saldoPendiente: number
  ubigeo: string | null
  fechaNacimiento: string | null
  activo: boolean
  observaciones: string | null
  createdAt: string
  updatedAt: string
  createdByName: string | null
  updatedByName: string | null
}

export type CustomersDashboardResponse = {
  summary: {
    totalCustomers: number
    activeCustomers: number
    inactiveCustomers: number
    withDocument: number
    withPhone: number
  }
  customers: CustomerItem[]
  options: {
    tiposPersona: string[]
    tiposDocumento: string[]
  }
}

export type CreateCustomerPayload = {
  tipoPersona?: string
  tipoDocumento?: string
  numeroDocumento?: string
  nombres?: string
  apellidos?: string
  razonSocial?: string
  email?: string
  telefono?: string
  direccion?: string
  permitirCredito?: boolean
  limiteCredito?: number
  ubigeo?: string
  fechaNacimiento?: string
  observaciones?: string
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload> & {
  activo?: boolean
}

export type CustomerSalesResponse = {
  sales: Array<{
    id: string
    createdAt: string
    document: string
    tipoComprobante: string
    totalAmount: number
    paidAmount: number
    outstandingAmount: number
    status: string
  }>
}

export type CustomerAccountStatementResponse = {
  summary: {
    creditLimit: number
    outstandingAmount: number
    availableCredit: number
  }
  movements: Array<{
    id: string
    createdAt: string
    movement: string
    document: string
    chargeAmount: number
    paymentAmount: number
    balanceAmount: number
    saleId: string
  }>
}
