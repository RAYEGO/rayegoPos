export type Branch = {
  id: string
  nombre: string
  codigo: string
  direccion: string | null
  telefono: string | null
  email: string | null
  activo: boolean
}

export type CreateBranchPayload = {
  nombre: string
  codigo: string
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  activo?: boolean
}

export type UpdateBranchPayload = {
  nombre?: string
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  activo?: boolean
}
