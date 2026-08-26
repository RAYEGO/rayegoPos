import { apiRequest } from '@/services/apiClient'
import type {
  CreateTipoEmpresaPayload,
  ModuloCatalogoItem,
  TipoEmpresaDetail,
  TipoEmpresaListItem,
  UpdateTipoEmpresaModulosPayload,
  UpdateTipoEmpresaPayload,
} from '@/types/admin-pos'

const MODULO_CATEGORIA_OPERACIONES = 'Operaciones'
const MODULO_CATEGORIA_SEGURIDAD = 'Seguridad'
const MODULO_CATEGORIA_REPORTES = 'Reportes'
const MODULO_CATEGORIA_PLATAFORMA = 'Plataforma'
const MODULO_CATEGORIA_CONFIGURACION = 'Configuración'
const MODULO_CATEGORIA_LOGISTICA = 'Logística'
const MODULO_CATEGORIA_ATENCION = 'Atención y Servicio'

const DEFAULT_MODULOS_CATALOGO: ModuloCatalogoItem[] = [
  { codigo: 'dashboard', nombre: 'Dashboard', descripcion: 'Panel principal con métricas.', icono: 'LayoutDashboard', categoria: MODULO_CATEGORIA_OPERACIONES, orden: 1, activo: true },
  { codigo: 'ventas', nombre: 'Ventas', descripcion: 'Gestión de ventas y comprobantes.', icono: 'ShoppingCart', categoria: MODULO_CATEGORIA_OPERACIONES, orden: 2, activo: true },
  { codigo: 'compras', nombre: 'Compras', descripcion: 'Ordenes de compra a proveedores.', icono: 'PackageOpen', categoria: MODULO_CATEGORIA_OPERACIONES, orden: 3, activo: true },
  { codigo: 'productos', nombre: 'Productos', descripcion: 'Catálogo de productos.', icono: 'Tags', categoria: MODULO_CATEGORIA_OPERACIONES, orden: 4, activo: true },
  { codigo: 'inventario', nombre: 'Inventario', descripcion: 'Control de stock global.', icono: 'Warehouse', categoria: MODULO_CATEGORIA_LOGISTICA, orden: 5, activo: true },
  { codigo: 'lotes', nombre: 'Lotes', descripcion: 'Lotes y vencimientos.', icono: 'Factory', categoria: MODULO_CATEGORIA_LOGISTICA, orden: 6, activo: true },
  { codigo: 'kardex', nombre: 'Kardex', descripcion: 'Movimientos valorizados.', icono: 'BookOpen', categoria: MODULO_CATEGORIA_LOGISTICA, orden: 7, activo: true },
  { codigo: 'clientes', nombre: 'Clientes', descripcion: 'Gestión de clientes.', icono: 'Users', categoria: MODULO_CATEGORIA_ATENCION, orden: 8, activo: true },
  { codigo: 'proveedores', nombre: 'Proveedores', descripcion: 'Gestión de proveedores.', icono: 'Truck', categoria: MODULO_CATEGORIA_LOGISTICA, orden: 9, activo: true },
  { codigo: 'caja', nombre: 'Caja', descripcion: 'Apertura, cierre y movimientos de caja.', icono: 'Banknote', categoria: MODULO_CATEGORIA_OPERACIONES, orden: 10, activo: true },
  { codigo: 'equipos', nombre: 'Equipos', descripcion: 'Equipos de clientes (servicio técnico).', icono: 'MonitorCog', categoria: MODULO_CATEGORIA_ATENCION, orden: 11, activo: true },
  { codigo: 'ordenes_servicio', nombre: 'Órdenes de Servicio', descripcion: 'Gestión de OT.', icono: 'ClipboardList', categoria: MODULO_CATEGORIA_ATENCION, orden: 12, activo: true },
  { codigo: 'diagnostico', nombre: 'Diagnóstico', descripcion: 'Diagnósticos técnicos.', icono: 'SearchCheck', categoria: MODULO_CATEGORIA_ATENCION, orden: 13, activo: true },
  { codigo: 'presupuestos', nombre: 'Presupuestos', descripcion: 'Presupuestos de reparación.', icono: 'Calculator', categoria: MODULO_CATEGORIA_ATENCION, orden: 14, activo: true },
  { codigo: 'reparaciones', nombre: 'Reparaciones', descripcion: 'Reparaciones en curso.', icono: 'Wrench', categoria: MODULO_CATEGORIA_ATENCION, orden: 15, activo: true },
  { codigo: 'entregas', nombre: 'Entregas', descripcion: 'Entrega de equipos reparados.', icono: 'PackageCheck', categoria: MODULO_CATEGORIA_ATENCION, orden: 16, activo: true },
  { codigo: 'usuarios', nombre: 'Usuarios', descripcion: 'Gestión de usuarios y accesos.', icono: 'UserCog', categoria: MODULO_CATEGORIA_SEGURIDAD, orden: 17, activo: true },
  { codigo: 'sesiones', nombre: 'Sesiones', descripcion: 'Sesiones activas de usuarios.', icono: 'KeyRound', categoria: MODULO_CATEGORIA_SEGURIDAD, orden: 18, activo: true },
  { codigo: 'auditoria', nombre: 'Auditoría', descripcion: 'Trazabilidad de cambios.', icono: 'ShieldCheck', categoria: MODULO_CATEGORIA_SEGURIDAD, orden: 19, activo: true },
  { codigo: 'reportes', nombre: 'Reportes', descripcion: 'Reportes operativos.', icono: 'BarChart3', categoria: MODULO_CATEGORIA_REPORTES, orden: 20, activo: true },
  { codigo: 'tipos_empresa', nombre: 'Tipos de Empresa', descripcion: 'Configuración de tipos y módulos.', icono: 'Puzzle', categoria: MODULO_CATEGORIA_PLATAFORMA, orden: 21, activo: true },
  { codigo: 'empresas', nombre: 'Empresas', descripcion: 'Administración de empresas.', icono: 'Building2', categoria: MODULO_CATEGORIA_PLATAFORMA, orden: 22, activo: true },
  { codigo: 'configuracion', nombre: 'Configuración', descripcion: 'Ajustes del sistema.', icono: 'Settings2', categoria: MODULO_CATEGORIA_CONFIGURACION, orden: 23, activo: true },
]

type StoredTipo = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  color: string | null
  orden: number
  activo: boolean
  modulosHabilitadosCodigos: string[]
  empresasCount: number
}

const MOCK_STORAGE_KEY = 'rayego.mock.admin-pos.tipos.v1'

function nextUUID(seed?: number): string {
  const n = seed ?? Date.now()
  const pad = (v: number, len = 4) => v.toString(16).padStart(len, '0').slice(0, len)
  return `${pad(n, 8)}-${pad(n + 1)}-${pad(n + 2)}-${pad(n + 3)}-${pad(n + 4, 12)}`
}

function defaultInitialTipos(): StoredTipo[] {
  const botica = DEFAULT_MODULOS_CATALOGO.filter((m) =>
    ['dashboard','ventas','compras','productos','inventario','lotes','kardex','clientes','proveedores','caja','usuarios','sesiones','auditoria','reportes','configuracion'].includes(m.codigo),
  ).map((m) => m.codigo)

  const servicio = DEFAULT_MODULOS_CATALOGO.filter((m) =>
    ['dashboard','clientes','equipos','ordenes_servicio','diagnostico','presupuestos','reparaciones','entregas','caja','reportes','configuracion','usuarios','sesiones','auditoria'].includes(m.codigo),
  ).map((m) => m.codigo)

  return [
    {
      id: '00000000-0000-0000-0000-000000000001',
      codigo: 'BOTICA',
      nombre: 'Botica / Farmacia',
      descripcion: 'Negocio de venta de medicamentos y productos de salud.',
      icono: 'Pill',
      color: '#2563eb',
      orden: 1,
      activo: true,
      modulosHabilitadosCodigos: botica,
      empresasCount: 1,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      codigo: 'SERVICIO_TECNICO',
      nombre: 'Servicio Técnico',
      descripcion: 'Taller de reparación y mantenimiento de equipos electrónicos.',
      icono: 'Wrench',
      color: '#16a34a',
      orden: 2,
      activo: true,
      modulosHabilitadosCodigos: servicio,
      empresasCount: 0,
    },
  ]
}

function loadTipos(): StoredTipo[] {
  if (typeof window === 'undefined') return defaultInitialTipos()
  try {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) {
      const init = defaultInitialTipos()
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(init))
      return init
    }
    return JSON.parse(raw) as StoredTipo[]
  } catch {
    return defaultInitialTipos()
  }
}

function saveTipos(tipos: StoredTipo[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(tipos))
  } catch {
    // ignore
  }
}

function toListItem(t: StoredTipo): TipoEmpresaListItem {
  return {
    id: t.id,
    codigo: t.codigo,
    nombre: t.nombre,
    descripcion: t.descripcion ?? null,
    icono: t.icono ?? null,
    color: t.color ?? null,
    orden: t.orden,
    activo: t.activo,
    modulosHabilitadosCount: t.modulosHabilitadosCodigos.length,
    empresasCount: t.empresasCount,
  }
}

function toDetail(t: StoredTipo): TipoEmpresaDetail {
  const map = new Map(DEFAULT_MODULOS_CATALOGO.map((m) => [m.codigo, m]))
  const modulos = t.modulosHabilitadosCodigos
    .map((c) => map.get(c))
    .filter((m): m is ModuloCatalogoItem => Boolean(m))
  return {
    id: t.id,
    codigo: t.codigo,
    nombre: t.nombre,
    descripcion: t.descripcion ?? null,
    icono: t.icono ?? null,
    color: t.color ?? null,
    orden: t.orden,
    activo: t.activo,
    modulosHabilitados: modulos,
  }
}

function shouldMockFallback(error: unknown): boolean {
  void error
  return false
}

export const adminPosService = {
  async listTiposEmpresa(accessToken: string): Promise<TipoEmpresaListItem[]> {
    try {
      return await apiRequest<TipoEmpresaListItem[]>('/api/admin-pos/tipos-empresa', { accessToken })
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      return loadTipos()
        .slice()
        .sort((a, b) => Number(b.activo) - Number(a.activo) || a.orden - b.orden || a.codigo.localeCompare(b.codigo))
        .map(toListItem)
    }
  },

  async createTipoEmpresa(accessToken: string, payload: CreateTipoEmpresaPayload): Promise<TipoEmpresaDetail> {
    try {
      return await apiRequest<TipoEmpresaDetail>('/api/admin-pos/tipos-empresa', {
        method: 'POST',
        accessToken,
        body: payload,
      })
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      const tipos = loadTipos()
      const codigo = (payload.codigo || '').trim().toUpperCase().replace(/\s+/g, '_')
      if (!codigo) throw new Error('El código es obligatorio.')
      if (tipos.some((t) => t.codigo === codigo)) {
        throw new Error('El código ya está en uso por otro tipo de empresa.')
      }
      const nuevo: StoredTipo = {
        id: nextUUID(),
        codigo,
        nombre: (payload.nombre || '').trim() || codigo,
        descripcion: payload.descripcion ?? null,
        icono: payload.icono ?? null,
        color: payload.color ?? null,
        orden: typeof payload.orden === 'number' ? payload.orden : tipos.length + 1,
        activo: payload.activo ?? true,
        modulosHabilitadosCodigos: Array.isArray(payload.modulosHabilitados) ? payload.modulosHabilitados.slice() : [],
        empresasCount: 0,
      }
      tipos.push(nuevo)
      saveTipos(tipos)
      return toDetail(nuevo)
    }
  },

  async getTipoEmpresa(accessToken: string, tipoId: string): Promise<TipoEmpresaDetail> {
    try {
      return await apiRequest<TipoEmpresaDetail>(`/api/admin-pos/tipos-empresa/${tipoId}`, { accessToken })
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      const tipos = loadTipos()
      const found = tipos.find((t) => t.id === tipoId)
      if (!found) throw new Error('El tipo de empresa no fue encontrado.')
      return toDetail(found)
    }
  },

  async updateTipoEmpresa(
    accessToken: string,
    tipoId: string,
    payload: UpdateTipoEmpresaPayload,
  ): Promise<TipoEmpresaDetail> {
    try {
      return await apiRequest<TipoEmpresaDetail>(`/api/admin-pos/tipos-empresa/${tipoId}`, {
        method: 'PUT',
        accessToken,
        body: payload,
      })
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      const tipos = loadTipos()
      const idx = tipos.findIndex((t) => t.id === tipoId)
      if (idx < 0) throw new Error('El tipo de empresa no fue encontrado.')
      const next = { ...tipos[idx] } as StoredTipo
      if (payload.nombre !== undefined) next.nombre = payload.nombre.trim()
      if (payload.descripcion !== undefined) next.descripcion = payload.descripcion
      if (payload.icono !== undefined) next.icono = payload.icono
      if (payload.color !== undefined) next.color = payload.color
      if (typeof payload.orden === 'number') next.orden = payload.orden
      if (typeof payload.activo === 'boolean') next.activo = payload.activo
      tipos[idx] = next
      saveTipos(tipos)
      return toDetail(next)
    }
  },

  async toggleTipoEmpresa(accessToken: string, tipoId: string): Promise<TipoEmpresaDetail> {
    try {
      return await apiRequest<TipoEmpresaDetail>(
        `/api/admin-pos/tipos-empresa/${tipoId}/toggle-status`,
        { method: 'PATCH', accessToken },
      )
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      const tipos = loadTipos()
      const idx = tipos.findIndex((t) => t.id === tipoId)
      if (idx < 0) throw new Error('El tipo de empresa no fue encontrado.')
      const next = { ...tipos[idx], activo: !tipos[idx].activo } as StoredTipo
      tipos[idx] = next
      saveTipos(tipos)
      return toDetail(next)
    }
  },

  async listModulos(accessToken: string): Promise<ModuloCatalogoItem[]> {
    try {
      return await apiRequest<ModuloCatalogoItem[]>('/api/admin-pos/modulos', { accessToken })
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      return DEFAULT_MODULOS_CATALOGO.slice().sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo))
    }
  },

  async getTipoEmpresaModulos(accessToken: string, tipoId: string): Promise<ModuloCatalogoItem[]> {
    try {
      return await apiRequest<ModuloCatalogoItem[]>(
        `/api/admin-pos/tipos-empresa/${tipoId}/modulos`,
        { accessToken },
      )
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      const tipos = loadTipos()
      const found = tipos.find((t) => t.id === tipoId)
      if (!found) throw new Error('El tipo de empresa no fue encontrado.')
      const map = new Map(DEFAULT_MODULOS_CATALOGO.map((m) => [m.codigo, m]))
      return found.modulosHabilitadosCodigos
        .map((c) => map.get(c))
        .filter((m): m is ModuloCatalogoItem => Boolean(m))
    }
  },

  async updateTipoEmpresaModulos(
    accessToken: string,
    tipoId: string,
    payload: UpdateTipoEmpresaModulosPayload,
  ): Promise<ModuloCatalogoItem[]> {
    try {
      return await apiRequest<ModuloCatalogoItem[]>(
        `/api/admin-pos/tipos-empresa/${tipoId}/modulos`,
        { method: 'PUT', accessToken, body: payload },
      )
    } catch (error) {
      if (!shouldMockFallback(error)) throw error
      const tipos = loadTipos()
      const idx = tipos.findIndex((t) => t.id === tipoId)
      if (idx < 0) throw new Error('El tipo de empresa no fue encontrado.')
      const validCodes = new Set(DEFAULT_MODULOS_CATALOGO.map((m) => m.codigo))
      const codigos = Array.from(new Set((payload.modulosHabilitados ?? []).filter((c) => validCodes.has(c))))
      const next = { ...tipos[idx], modulosHabilitadosCodigos: codigos } as StoredTipo
      tipos[idx] = next
      saveTipos(tipos)
      const map = new Map(DEFAULT_MODULOS_CATALOGO.map((m) => [m.codigo, m]))
      return codigos
        .map((c) => map.get(c))
        .filter((m): m is ModuloCatalogoItem => Boolean(m))
    }
  },
}
