import { apiRequest } from '@/services/apiClient'

export type ReceiptAuditAction =
  | 'VIEW_RECEIPT'
  | 'PRINT_RECEIPT'
  | 'DOWNLOAD_RECEIPT_PDF'
  | 'SHARE_RECEIPT'

export const auditService = {
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

