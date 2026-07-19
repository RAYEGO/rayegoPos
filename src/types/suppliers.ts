export type SupplierStatusFilter = 'activo' | 'inactivo'

export type SupplierItem = {
  id: string
  tipoPersona: string
  tipoDocumento: string
  numeroDocumento: string
  razonSocial: string
  nombreComercial: string | null
  contactoNombre: string | null
  contactoTelefono: string | null
  email: string | null
  direccion: string | null
  ubigeo: string | null
  activo: boolean
  observaciones: string | null
  createdAt: string
  updatedAt: string
  createdByName: string | null
  updatedByName: string | null
}

export type SuppliersDashboardResponse = {
  summary: {
    totalSuppliers: number
    activeSuppliers: number
    inactiveSuppliers: number
  }
  suppliers: SupplierItem[]
  options: {
    tiposPersona: string[]
    tiposDocumento: string[]
  }
}

export type CreateSupplierPayload = {
  tipoPersona?: string
  tipoDocumento?: string
  numeroDocumento: string
  razonSocial: string
  nombreComercial?: string
  contactoNombre?: string
  contactoTelefono?: string
  email?: string
  direccion?: string
  ubigeo?: string
  observaciones?: string
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload> & {
  activo?: boolean
}
