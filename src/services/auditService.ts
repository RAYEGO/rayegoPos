import { apiRequest } from '@/services/apiClient'

export type ReceiptAuditAction =
  | 'VIEW_RECEIPT'
  | 'PRINT_RECEIPT'
  | 'DOWNLOAD_RECEIPT_PDF'
  | 'SHARE_RECEIPT'

type AuditActionCore =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ANULAR'

export type AuditAction = AuditActionCore | ReceiptAuditAction

export type AuditActorInfo = {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string | null
}

export type AuditListEntry = {
  id: string
  usuarioId: string | null
  usuario: AuditActorInfo | null
  tabla: string
  registroId: string | null
  accion: AuditAction
  fechaEvento: string
  valorAnterior: Record<string, unknown> | null
  valorNuevo: Record<string, unknown> | null
  direccionIp: string | null
  userAgent: string | null
}

export type AuditListParams = {
  search?: string
  userId?: string
  tabla?: string
  accion?: AuditAction
  fechaDesde?: string
  fechaHasta?: string
  limit?: number
  offset?: number
}

export type AuditListResponse = {
  items: AuditListEntry[]
  total: number
  limit: number
  offset: number
}

export const auditService = {
  async list(
    accessToken: string,
    params: AuditListParams = {},
  ): Promise<AuditListResponse> {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.userId) query.set('usuarioId', params.userId)
    if (params.tabla) query.set('tabla', params.tabla)
    if (params.accion) query.set('accion', params.accion)
    if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde)
    if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta)
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))

    const qs = query.toString()
    const url = qs ? `/api/audit?${qs}` : '/api/audit'
    return apiRequest<AuditListResponse>(url, {
      method: 'GET',
      accessToken,
    })
  },

  logReceiptAction(
    accessToken: string,
    saleId: string,
    action: ReceiptAuditAction,
    meta?: Record<string, unknown>,
  ) {
    return apiRequest<void>('/api/audit', {
      method: 'POST',
      accessToken,
      body: {
        tabla: 'ventas',
        registroId: saleId,
        accion: action,
        valorNuevo: meta,
      },
    })
  },
}

