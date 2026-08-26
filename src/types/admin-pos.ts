export type TipoEmpresaListItem = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  color: string | null
  orden: number
  activo: boolean
  modulosHabilitadosCount: number
  empresasCount: number
}

export type ModuloCatalogoItem = {
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  categoria: string | null
  orden: number
  activo: boolean
}

export type TipoEmpresaDetail = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  color: string | null
  orden: number
  activo: boolean
  modulosHabilitados: ModuloCatalogoItem[]
}

export type CreateTipoEmpresaPayload = {
  codigo: string
  nombre: string
  descripcion?: string | null
  icono?: string | null
  color?: string | null
  orden?: number
  activo?: boolean
  modulosHabilitados?: string[]
}

export type UpdateTipoEmpresaPayload = {
  nombre?: string
  descripcion?: string | null
  icono?: string | null
  color?: string | null
  orden?: number
  activo?: boolean
}

export type UpdateTipoEmpresaModulosPayload = {
  modulosHabilitados: string[]
}

export type EmpresaListItem = {
  id: string
  razonSocial: string
  nombreComercial: string | null
  numeroDocumento: string
  tipoEmpresa: {
    id: string
    codigo: string
    nombre: string
    color: string | null
    activo: boolean
  }
  sucursalesCount: number
  usuariosCount: number
  activo: boolean
  createdAt: string | null
}

export type EmpresaDetail = {
  id: string
  tipoEmpresaId: string
  razonSocial: string
  nombreComercial: string | null
  tipoDocumento: 'DNI' | 'RUC' | 'CE' | 'PASAPORTE' | 'OTRO'
  numeroDocumento: string
  email: string | null
  telefono: string | null
  direccion: string | null
  ubigeo: string | null
  monedaBase: string
  zonaHoraria: string
  activo: boolean
  createdAt: string | null
  tipoEmpresa: {
    id: string
    codigo: string
    nombre: string
    color: string | null
    activo: boolean
  }
  sucursalesCount: number
  usuariosCount: number
}

export type CreateEmpresaPayload = {
  tipoEmpresaId: string
  razonSocial: string
  nombreComercial?: string | null
  tipoDocumento?: EmpresaDetail['tipoDocumento']
  numeroDocumento: string
  email?: string | null
  telefono?: string | null
  direccion?: string | null
  ubigeo?: string | null
  monedaBase?: string
  zonaHoraria?: string
  activo?: boolean
}

export type UpdateEmpresaPayload = Partial<CreateEmpresaPayload>
