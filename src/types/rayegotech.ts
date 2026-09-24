export type UsoServicioTecnico = 'SOLO_VENTA' | 'SERVICIO_TECNICO' | 'AMBOS'
export type EstadoOrdenServicio =
  | 'RECEPCIONADO'
  | 'EN_DIAGNOSTICO'
  | 'PRESUPUESTADO'
  | 'ESPERANDO_AUTORIZACION'
  | 'EN_REPARACION'
  | 'TRABAJO_TERMINADO'
  | 'LISTO_PARA_COBRO'
  | 'PAGADO'
  | 'ENTREGADO'
  | 'RECIBIDO'
  | 'DIAGNOSTICO'
  | 'PRESUPUESTO'
  | 'ESPERANDO_APROBACION'
  | 'APROBADO'
  | 'EN_PRUEBAS'
  | 'LISTO_PARA_ENTREGA'
  | 'PENDIENTE_RETIRO'
  | 'RECHAZADO'
  | 'CANCELADO'
  | 'EN_GARANTIA'

export const ESTADO_ORDEN_LABEL: Record<EstadoOrdenServicio, string> = {
  RECEPCIONADO: 'Recepcionado',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADO: 'Presupuestado',
  ESPERANDO_AUTORIZACION: 'Esperando autorización',
  EN_REPARACION: 'En reparación',
  TRABAJO_TERMINADO: 'Trabajo terminado',
  LISTO_PARA_COBRO: 'Listo para cobro',
  PAGADO: 'Pagado',
  ENTREGADO: 'Entregado',
  RECIBIDO: 'Recibido (legacy)',
  DIAGNOSTICO: 'Diagnóstico (legacy)',
  PRESUPUESTO: 'Presupuesto (legacy)',
  ESPERANDO_APROBACION: 'Esperando aprobación (legacy)',
  APROBADO: 'Aprobado (legacy)',
  EN_PRUEBAS: 'En pruebas (legacy)',
  LISTO_PARA_ENTREGA: 'Listo para entrega (legacy)',
  PENDIENTE_RETIRO: 'Pendiente retiro (legacy)',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
  EN_GARANTIA: 'En garantía',
}

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'outline'

export function estadoOrdenLabel(e: EstadoOrdenServicio | string): string {
  return ESTADO_ORDEN_LABEL[e as EstadoOrdenServicio] || String(e)
}

export function estadoOrdenBadgeVariant(e: EstadoOrdenServicio | string): BadgeVariant {
  switch (e) {
    case 'PAGADO':
    case 'ENTREGADO':
      return 'success'
    case 'CANCELADO':
    case 'RECHAZADO':
      return 'destructive'
    case 'ESPERANDO_AUTORIZACION':
    case 'LISTO_PARA_COBRO':
    case 'EN_REPARACION':
    case 'EN_DIAGNOSTICO':
    case 'TRABAJO_TERMINADO':
      return 'warning'
    case 'RECEPCIONADO':
    case 'PRESUPUESTADO':
      return 'info'
    case 'EN_GARANTIA':
      return 'outline'
    default:
      return 'default'
  }
}

export type TipoItemOrdenServicio = 'REPUESTO' | 'MANO_OBRA' | 'ACCESORIO_ENTREGADO' | 'SERVICIO_ADICIONAL'
export type EstadoFisicoEquipo = 'NUEVO' | 'USADO' | 'REPARADO' | 'DE' | 'ROTO' | 'DE_PRESTAMO'
export type EspecialidadTecnico = 'Celular' | 'PC' | 'Laptop' | 'Impresoras' | 'Audio'

export type TipoEquipo = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  empresaId: string
}

export type TipoServicio = {
  id: string
  nombre: string
  descripcion: string | null
  costoBase: number
  activo: boolean
  empresaId: string
}

export type Tecnico = {
  id: string
  usuarioId: string
  especialidades: EspecialidadTecnico[]
  activo: boolean
  empresaId: string
  createdById: string
  updatedById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  usuario?: {
    id: string
    nombres: string
    apellidos: string
    email: string
    numeroDocumento: string
    activo: boolean
  }
}

export type ClienteEquipo = {
  id: string
  clienteId: string
  tipoEquipoId: string
  marca: string
  modelo: string
  numeroSerie: string | null
  numeroImei: string | null
  capacidadAlmacenamiento: string | null
  memoriaRam: string | null
  color: string | null
  observaciones: string | null
  estadoFisico: EstadoFisicoEquipo
  garantiaDias: number
  activo: boolean
  empresaId: string
  sucursalId: string
  createdById: string
  updatedById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  tipoEquipo?: TipoEquipo
  cliente?: { id: string; nombresRazonSocial: string; numeroDocumento: string }
}

export type OrdenItem = {
  id: string
  ordenServicioId: string
  tipo: TipoItemOrdenServicio
  productoId: string | null
  loteId: string | null
  descripcion: string | null
  cantidad: number
  precioUnitario: number
  descuentoUnitario: number
  subtotal: number
  tecnicoAsignadoId: string | null
  garantiaAplicadaDias: number
  observaciones: string | null
  createdById: string
  updatedById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  producto?: { id: string; nombre: string; sku: string }
  lote?: { id: string; numeroLote: string; vencimiento: string | null }
  tecnicoAsignado?: Tecnico
}

export type OrdenPago = {
  id: string
  ordenServicioId: string
  monto: number
  fechaPago: string
  formaPagoId: string
  referencia: string | null
  comentarios: string | null
  movimientoCajaId: string | null
  createdById: string
  createdAt: string
  formaPago?: { id: string; codigo: string; nombre: string }
  movimientoCaja?: { id: string; tipo: string; operacion: string }
}

export type DiagnosticoOrden = {
  id: string
  ordenServicioId: string
  tecnicoId: string | null
  resumen: string
  detalle: string | null
  recomendaciones: string | null
  fechaDiagnostico: string
  createdById: string
  createdAt: string
  usuario?: { id: string; nombres: string; apellidos: string }
}

export type PresupuestoOrden = {
  id: string
  ordenServicioId: string
  version: number
  descripcion: string | null
  montoManoObra: number
  montoRepuestos: number
  montoServicios: number
  subTotal: number
  igvPorcentaje: number
  igvMonto: number
  total: number
  estado: 'BORRADOR' | 'PENDIENTE_APROBACION' | 'APROBADO_CLIENTE' | 'RECHAZADO_CLIENTE'
  fechaCreacion: string
  fechaAprobacionCliente: string | null
  comentariosAprobacion: string | null
  createdById: string
  usuario?: { id: string; nombres: string; apellidos: string }
}

export type EstadoHistorialOrden = {
  id: string
  ordenServicioId: string
  estadoAnterior: EstadoOrdenServicio | null
  estadoNuevo: EstadoOrdenServicio
  observaciones: string | null
  fechaCambio: string
  usuarioId: string
  usuario?: { id: string; nombres: string; apellidos: string }
}

export type AsignacionTecnicoOrden = {
  id: string
  ordenServicioId: string
  tecnicoId: string
  fechaAsignacion: string
  fechaLiberacion: string | null
  asignadoPorId: string
  observaciones: string | null
  tecnico?: Tecnico
  usuario?: { id: string; nombres: string; apellidos: string }
}

export type GarantiaOrden = {
  id: string
  ordenServicioId: string
  fechaInicio: string
  fechaFin: string
  dias: number
  terminos: string | null
  estado: 'VIGENTE' | 'VENCIDA' | 'UTILIZADA'
  reclamacionFecha: string | null
  reclamacionDetalle: string | null
  ordenReingresoId: string | null
  createdById: string
  updatedById: string
}

export type OrdenServicio = {
  id: string
  numeroOrden: string
  estado: EstadoOrdenServicio
  tipoServicioId: string | null
  fechaRecepcion: string
  fechaPrometida: string | null
  fechaEntregado: string | null
  clienteEquipoId: string | null
  clienteId: string
  tecnicoAsignadoId: string | null
  clienteReporto: string | null
  diagnosticoRecepcion: string | null
  montoManoObra: number
  montoRepuestos: number
  montoServicios: number
  subTotal: number
  igvPorcentaje: number
  igvMonto: number
  total: number
  saldoPendiente: number
  garantiaDiasAplicados: number
  garantiaVence: string | null
  aprobadoPorClienteAt: string | null
  creadoEnSucursalId: string
  empresaId: string
  sucursalId: string
  createdById: string
  updatedById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  cliente?: { id: string; nombresRazonSocial: string; numeroDocumento: string; telefono: string | null; email: string | null }
  clienteEquipo?: ClienteEquipo & { tipoEquipo?: TipoEquipo }
  tecnicoAsignado?: Tecnico
  items?: OrdenItem[]
  pagos?: OrdenPago[]
  historialEstados?: EstadoHistorialOrden[]
  diagnosticos?: DiagnosticoOrden[]
  presupuestos?: PresupuestoOrden[]
  asignacionesTecnico?: AsignacionTecnicoOrden[]
  garantia?: GarantiaOrden | null
}

export type CreateOrdenServicioPayload = {
  clienteId: string
  clienteEquipoId?: string
  tipoServicioId?: string | null
  tecnicoAsignadoId?: string | null
  fechaRecepcion?: string
  fechaPrometida?: string
  clienteReporto?: string | null
  diagnosticoRecepcion?: string | null
  observaciones?: string | null
  garantiaDias?: number
  igvPorcentaje?: number
  items?: Array<Record<string, unknown>>
  descripcionPresupuesto?: string | null
}

export type ChangeEstadoOrdenPayload = {
  estado: EstadoOrdenServicio
  observaciones?: string | null
  terminosGarantia?: string | null
}
export type AsignarTecnicoPayload = { tecnicoId: string; observaciones?: string | null }
export type CrearPresupuestoPayload = {
  descripcion?: string | null
  montoManoObra?: number
  montoRepuestos?: number
  montoServicios?: number
  items?: Array<Record<string, unknown>>
}
export type AprobarPresupuestoPayload = {
  version: number
  accion?: 'APROBAR' | 'RECHAZAR'
  comentarios?: string | null
}
export type AddDiagnosticoPayload = {
  resumen: string
  detalle?: string | null
  recomendaciones?: string | null
  tecnicoId?: string | null
}
export type AddOrdenItemPayload = {
  tipo: TipoItemOrdenServicio
  productoId?: string | null
  loteId?: string | null
  descripcion?: string | null
  cantidad: number
  precioUnitario?: number
  descuentoUnitario?: number
  tecnicoAsignadoId?: string | null
  garantiaAplicadaDias?: number
  observaciones?: string | null
}
export type RegistrarPagoOrdenPayload = {
  monto: number
  formaPagoId: string
  referencia?: string | null
  comentarios?: string | null
}

export type CreateTecnicoPayload = {
  usuarioId: string
  especialidades?: EspecialidadTecnico[]
  activo?: boolean
}
export type UpdateTecnicoPayload = Partial<CreateTecnicoPayload>

export type CreateEquipoPayload = {
  clienteId: string
  tipoEquipoId: string
  marca: string
  modelo: string
  numeroSerie?: string | null
  numeroImei?: string | null
  capacidadAlmacenamiento?: string | null
  memoriaRam?: string | null
  color?: string | null
  observaciones?: string | null
  estadoFisico?: EstadoFisicoEquipo
  garantiaDias?: number
  activo?: boolean
}
export type UpdateEquipoPayload = Partial<Omit<CreateEquipoPayload, 'clienteId'>>

export type CreateTipoEquipoPayload = { nombre: string; descripcion?: string | null; activo?: boolean }
export type CreateTipoServicioPayload = {
  nombre: string
  descripcion?: string | null
  costoBase?: number
  activo?: boolean
}

export type OrdenesListFilters = {
  estado?: EstadoOrdenServicio | EstadoOrdenServicio[]
  desde?: string
  hasta?: string
  search?: string
  sucursalId?: string
  clienteId?: string
  tecnicoAsignadoId?: string
}

export type MovimientoInventarioRT = {
  id: string
  tipoMovimiento:
    | 'SERVICIO_TECNICO_CONSUMO'
    | 'SERVICIO_TECNICO_DEVOLUCION'
    | string
  cantidad: number
  cantidadSigno?: string
  productoId?: string | null
  productoNombre?: string | null
  loteId?: string | null
  loteCodigo?: string | null
  ordenServicioId?: string | null
  ordenServicioNumero?: string | null
  tecnicoId?: string | null
  tecnicoNombre?: string | null
  observaciones?: string | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

export type ListMovimientosInventarioFilters = {
  origen?: 'SERVICIO_TECNICO' | string
  ordenServicioId?: string
  tipoMovimiento?: string
  search?: string
}
