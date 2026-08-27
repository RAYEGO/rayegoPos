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
  hasAdminEmpresa: boolean
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
  hasAdminEmpresa: boolean
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

export type CreateEmpresaOnboardingPayload = {
  empresa: CreateEmpresaPayload
  sucursal: {
    codigo: string
    nombre: string
    direccion?: string | null
    telefono?: string | null
    email?: string | null
    ubigeo?: string | null
  }
  admin: {
    username: string
    email?: string | null
    password: string
    nombres: string
    apellidos: string
    tipoDocumento?: EmpresaDetail['tipoDocumento']
    numeroDocumento?: string | null
    telefono?: string | null
    activo?: boolean
  }
}

export type EmpresaOnboardingResult = {
  empresa: EmpresaDetail
  sucursalId: string
  adminUsuario: {
    id: string
    username: string
    email: string | null
  }
}

export type EmpresaSucursalListItem = {
  id: string
  codigo: string
  nombre: string
  activo: boolean
  esPrincipal: boolean
}

export type EmpresaAdminListItem = {
  id: string
  username: string
  email: string | null
  nombres: string
  apellidos: string
  telefono: string | null
  activo: boolean
  sucursalIds: string[]
}

export type CreateEmpresaAdminPayload = {
  username: string
  email?: string | null
  password: string
  nombres: string
  apellidos: string
  tipoDocumento?: EmpresaDetail['tipoDocumento']
  numeroDocumento?: string | null
  telefono?: string | null
  activo?: boolean
  sucursalId?: string | null
  sucursal?: {
    codigo: string
    nombre: string
    direccion?: string | null
    telefono?: string | null
    email?: string | null
    ubigeo?: string | null
  } | null
}

export type UpdateEmpresaAdminPayload = {
  email?: string | null
  password?: string | null
  nombres?: string
  apellidos?: string
  tipoDocumento?: EmpresaDetail['tipoDocumento']
  numeroDocumento?: string | null
  telefono?: string | null
  activo?: boolean
  sucursalId?: string | null
}
