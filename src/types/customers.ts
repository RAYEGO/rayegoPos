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
  ubigeo?: string
  fechaNacimiento?: string
  observaciones?: string
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload> & {
  activo?: boolean
}

