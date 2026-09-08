import { apiRequest } from '@/services/apiClient'
import type {
  AddDiagnosticoPayload,
  AddOrdenItemPayload,
  AprobarPresupuestoPayload,
  AsignarTecnicoPayload,
  ChangeEstadoOrdenPayload,
  ClienteEquipo,
  CreateEquipoPayload,
  CreateOrdenServicioPayload,
  CreateTecnicoPayload,
  CreateTipoEquipoPayload,
  CreateTipoServicioPayload,
  CrearPresupuestoPayload,
  ListMovimientosInventarioFilters,
  MovimientoInventarioRT,
  OrdenesListFilters,
  OrdenServicio,
  OrdenPago,
  RegistrarPagoOrdenPayload,
  Tecnico,
  TipoEquipo,
  TipoServicio,
  UpdateEquipoPayload,
  UpdateTecnicoPayload,
} from '@/types/rayegotech'

function buildQuery(filters: Record<string, unknown>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => sp.append(`${k}[]`, String(x)))
    else sp.set(k, String(v))
  }
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export const rtService = {
  // ============ CATÁLOGOS ============
  listTiposEquipo() {
    return apiRequest<{ items: TipoEquipo[] }>('/api/rt/catalogos/tipos-equipo')
  },
  createTipoEquipo(payload: CreateTipoEquipoPayload) {
    return apiRequest<{ item: TipoEquipo }>('/api/rt/catalogos/tipos-equipo', {
      method: 'POST',
      body: payload,
    })
  },
  listTiposServicio() {
    return apiRequest<{ items: TipoServicio[] }>('/api/rt/catalogos/tipos-servicio')
  },
  createTipoServicio(payload: CreateTipoServicioPayload) {
    return apiRequest<{ item: TipoServicio }>('/api/rt/catalogos/tipos-servicio', {
      method: 'POST',
      body: payload,
    })
  },

  // ============ TÉCNICOS ============
  listTecnicos(includeInactive = false) {
    return apiRequest<{ items: Tecnico[] }>(`/api/rt/tecnicos${includeInactive ? '?all=1' : ''}`)
  },
  getTecnico(id: string) {
    return apiRequest<{ item: Tecnico }>(`/api/rt/tecnicos/${id}`)
  },
  createTecnico(payload: CreateTecnicoPayload) {
    return apiRequest<{ item: Tecnico }>('/api/rt/tecnicos', { method: 'POST', body: payload })
  },
  updateTecnico(id: string, payload: UpdateTecnicoPayload) {
    return apiRequest<{ item: Tecnico }>(`/api/rt/tecnicos/${id}`, { method: 'PUT', body: payload })
  },
  deleteTecnico(id: string) {
    return apiRequest<{ success: boolean }>(`/api/rt/tecnicos/${id}`, { method: 'DELETE' })
  },

  // ============ EQUIPOS CLIENTE ============
  listEquipos(clienteId?: string) {
    return apiRequest<{ items: ClienteEquipo[] }>(
      `/api/rt/equipos${clienteId ? `?clienteId=${clienteId}` : ''}`,
    )
  },
  getEquipo(id: string) {
    return apiRequest<{ item: ClienteEquipo }>(`/api/rt/equipos/${id}`)
  },
  createEquipo(payload: CreateEquipoPayload) {
    return apiRequest<{ item: ClienteEquipo }>('/api/rt/equipos', { method: 'POST', body: payload })
  },
  updateEquipo(id: string, payload: UpdateEquipoPayload) {
    return apiRequest<{ item: ClienteEquipo }>(`/api/rt/equipos/${id}`, { method: 'PUT', body: payload })
  },

  // ============ ÓRDENES SERVICIO ============
  listOrdenes(filters: OrdenesListFilters = {}) {
    return apiRequest<{ items: OrdenServicio[]; total?: number }>(
      `/api/rt/ordenes-servicio${buildQuery(filters as Record<string, unknown>)}`,
    )
  },
  getOrden(id: string) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}`)
  },
  createOrden(payload: CreateOrdenServicioPayload) {
    return apiRequest<{ item: OrdenServicio }>('/api/rt/ordenes-servicio', { method: 'POST', body: payload })
  },
  cambiarEstadoOrden(id: string, payload: ChangeEstadoOrdenPayload) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}/estado`, {
      method: 'PUT',
      body: payload,
    })
  },
  asignarTecnicoOrden(id: string, payload: AsignarTecnicoPayload) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}/asignar-tecnico`, {
      method: 'PUT',
      body: payload,
    })
  },
  crearPresupuesto(id: string, payload: CrearPresupuestoPayload) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}/presupuestos`, {
      method: 'POST',
      body: payload,
    })
  },
  aprobarPresupuesto(id: string, payload: AprobarPresupuestoPayload) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}/presupuestos/aprobar`, {
      method: 'PUT',
      body: payload,
    })
  },
  addDiagnostico(id: string, payload: AddDiagnosticoPayload) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}/diagnosticos`, {
      method: 'POST',
      body: payload,
    })
  },
  addOrdenItem(id: string, payload: AddOrdenItemPayload) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/ordenes-servicio/${id}/items`, {
      method: 'POST',
      body: payload,
    })
  },
  deleteOrdenItem(itemId: string) {
    return apiRequest<{ item: OrdenServicio }>(`/api/rt/items/${itemId}`, { method: 'DELETE' })
  },
  registrarPago(id: string, payload: RegistrarPagoOrdenPayload) {
    return apiRequest<{ item: OrdenServicio; pago: OrdenPago }>(`/api/rt/ordenes-servicio/${id}/pagos`, {
      method: 'POST',
      body: payload,
    })
  },
  // ============ INVENTARIO SERVICIO TÉCNICO ============
  listMovimientosInventario(filters: ListMovimientosInventarioFilters = {}) {
    return apiRequest<{ items: MovimientoInventarioRT[] }>(
      `/api/rt/inventario/movimientos${buildQuery(filters)}`,
    )
  },
}
