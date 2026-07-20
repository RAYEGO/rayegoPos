import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader } from '@/components/ui/loader'
import { salesService } from '@/services/salesService'
import { auditService } from '@/services/auditService'
import { createReceiptPdf } from '@/lib/receiptPdf'
import { ReceiptViewer } from '@/components/sales/ReceiptViewer'
import type { SaleReceiptResponse } from '@/types/sales'
import { ApiError, ApiNetworkError } from '@/services/apiClient'

type ReceiptSaleRef = {
  id: string
  code: string
}

export type ReceiptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessToken: string
  sale: ReceiptSaleRef | null
  initialReceipt?: SaleReceiptResponse | null
  onUnauthorized?: () => Promise<void> | void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible completar la operación.'
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ReceiptDialog({
  open,
  onOpenChange,
  accessToken,
  sale,
  initialReceipt = null,
  onUnauthorized,
}: ReceiptDialogProps) {
  const [receipt, setReceipt] = useState<SaleReceiptResponse | null>(initialReceipt)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasLoggedView, setHasLoggedView] = useState(false)

  useEffect(() => {
    setReceipt(initialReceipt)
  }, [initialReceipt, sale?.id])

  const message = useMemo(() => {
    if (!receipt) return null

    const header = `${receipt.company.nombreComercial ?? receipt.company.razonSocial}`
    const lines = [
      header,
      `Comprobante: ${receipt.document.correlativo}`,
      `Fecha: ${formatDateTime(receipt.issuedAt)}`,
      `Total: ${formatCurrency(receipt.totals.total)}`,
      'Adjunto ticket en PDF.',
    ]
    return lines.join('\n')
  }, [receipt])

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false)
      setHasLoggedView(false)
      setError(null)
      return
    }

    if (!accessToken || !sale?.id) {
      return
    }

    if (receipt) {
      if (!hasLoggedView) {
        setHasLoggedView(true)
        void auditService
          .logReceiptAction(accessToken, sale.id, 'VIEW_RECEIPT', {
            source: 'ReceiptDialog',
          })
          .catch(() => null)
      }
      return
    }

    setIsLoading(true)
    setError(null)

    salesService
      .getReceipt(accessToken, sale.id)
      .then((response) => {
        setReceipt(response)
        if (!hasLoggedView) {
          setHasLoggedView(true)
          void auditService
            .logReceiptAction(accessToken, sale.id, 'VIEW_RECEIPT', {
              source: 'ReceiptDialog',
            })
            .catch(() => null)
        }
      })
      .catch(async (nextError) => {
        if (nextError instanceof ApiError && nextError.status === 401) {
          toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
          await onUnauthorized?.()
          return
        }

        setReceipt(null)
        setError(getApiErrorMessage(nextError))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [accessToken, hasLoggedView, onUnauthorized, open, receipt, sale?.id])

  const handlePrint = useCallback(() => {
    if (!sale?.id || !accessToken) return

    void auditService
      .logReceiptAction(accessToken, sale.id, 'PRINT_RECEIPT', {
        source: 'ReceiptDialog',
      })
      .catch(() => null)

    const url = `/print/sales/${sale.id}?print=1`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [accessToken, sale?.id])

  const handleDownloadPdf = useCallback(async () => {
    if (!sale?.id || !receipt || !accessToken) return

    try {
      const fileName = `ticket-${receipt.document.correlativo}.pdf`
      const blob = createReceiptPdf(receipt)
      const file = new File([blob], fileName, { type: 'application/pdf' })
      downloadFile(file)
      await auditService.logReceiptAction(accessToken, sale.id, 'DOWNLOAD_RECEIPT_PDF', {
        source: 'ReceiptDialog',
      })
      toast.success('PDF descargado.')
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, receipt, sale?.id])

  const handleShare = useCallback(async () => {
    if (!sale?.id || !receipt || !accessToken) return

    const shareMessage = message ?? `Ticket ${receipt.document.correlativo}`

    try {
      const fileName = `ticket-${receipt.document.correlativo}.pdf`
      const blob = createReceiptPdf(receipt)
      const file = new File([blob], fileName, { type: 'application/pdf' })

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `Ticket ${receipt.document.correlativo}`,
          text: shareMessage,
          files: [file],
        })
        await auditService.logReceiptAction(accessToken, sale.id, 'SHARE_RECEIPT', {
          source: 'ReceiptDialog',
        })
        return
      }

      downloadFile(file)
      await auditService.logReceiptAction(accessToken, sale.id, 'DOWNLOAD_RECEIPT_PDF', {
        source: 'ReceiptDialog',
        fallback: 'download',
      })
      await copyToClipboard(shareMessage)
      toast.success('PDF descargado. Mensaje copiado para compartir.')
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
        await onUnauthorized?.()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, message, onUnauthorized, receipt, sale?.id])

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current)
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          setReceipt(null)
        }
      }}
    >
      <DialogContent
        className={
          isFullscreen
            ? 'h-[96vh] w-[96vw] max-w-[96vw] overflow-y-auto'
            : 'max-h-[90vh] overflow-y-auto sm:max-w-2xl'
        }
      >
        <DialogHeader>
          <DialogTitle>Ticket 80mm</DialogTitle>
          <DialogDescription>Venta {sale?.code ?? '—'}.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader className="h-7 w-7" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : receipt ? (
          <ReceiptViewer receipt={receipt} />
        ) : null}

        <div className="grid gap-2">
          <Button type="button" onClick={handlePrint} disabled={!sale?.id}>
            Imprimir
          </Button>
          <Button type="button" variant="outline" onClick={handleDownloadPdf} disabled={!receipt}>
            Guardar PDF
          </Button>
          <Button type="button" variant="outline" onClick={handleShare} disabled={!receipt}>
            Compartir
          </Button>
          <Button type="button" variant="ghost" onClick={handleToggleFullscreen} disabled={!receipt}>
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                Salir de pantalla completa
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                Ver en pantalla completa
              </>
            )}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

