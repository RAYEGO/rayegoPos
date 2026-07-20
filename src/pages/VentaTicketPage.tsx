import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { ReceiptViewer } from '@/components/sales/ReceiptViewer'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { salesService } from '@/services/salesService'
import { auditService } from '@/services/auditService'
import { createReceiptPdf } from '@/lib/receiptPdf'
import type { SaleReceiptResponse } from '@/types/sales'

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

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible cargar el ticket.'
}

export function VentaTicketPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const params = useParams()
  const [searchParams] = useSearchParams()
  const saleId = params.id ?? ''

  const [receipt, setReceipt] = useState<SaleReceiptResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoggedView, setHasLoggedView] = useState(false)

  useEffect(() => {
    setHasLoggedView(false)
  }, [saleId])

  const handleUnauthorized = useCallback(async () => {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }, [logout])

  const loadReceipt = useCallback(async () => {
    if (!accessToken || !saleId) {
      setIsLoading(false)
      setReceipt(null)
      setError('No se encontró la venta.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await salesService.getReceipt(accessToken, saleId)
      setReceipt(response)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      setReceipt(null)
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, handleUnauthorized, saleId])

  useEffect(() => {
    void loadReceipt()
  }, [loadReceipt])

  useEffect(() => {
    if (!receipt || !accessToken || !saleId || hasLoggedView) {
      return
    }

    setHasLoggedView(true)
    void auditService
      .logReceiptAction(accessToken, saleId, 'VIEW_RECEIPT', {
        source: 'VentaTicketPage',
      })
      .catch(() => null)
  }, [accessToken, hasLoggedView, receipt, saleId])

  const whatsAppMessage = useMemo(() => {
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
    if (!receipt) return
    if (searchParams.get('print') !== '1') return

    const timer = window.setTimeout(() => {
      window.print()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [receipt, searchParams])

  const handlePrint = useCallback(() => {
    if (accessToken && saleId) {
      void auditService
        .logReceiptAction(accessToken, saleId, 'PRINT_RECEIPT', {
          source: 'VentaTicketPage',
        })
        .catch(() => null)
    }
    window.print()
  }, [accessToken, saleId])

  const handleShare = useCallback(async () => {
    if (!receipt) return

    const message = whatsAppMessage ?? `Ticket ${receipt.document.correlativo}`

    try {
      const fileName = `ticket-${receipt.document.correlativo}.pdf`
      const blob = createReceiptPdf(receipt)
      const file = new File([blob], fileName, { type: 'application/pdf' })

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `Ticket ${receipt.document.correlativo}`,
          text: message,
          files: [file],
        })
        if (accessToken && saleId) {
          await auditService.logReceiptAction(accessToken, saleId, 'SHARE_RECEIPT', {
            source: 'VentaTicketPage',
          })
        }
        return
      }

      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      if (accessToken && saleId) {
        await auditService.logReceiptAction(accessToken, saleId, 'DOWNLOAD_RECEIPT_PDF', {
          source: 'VentaTicketPage',
          fallback: 'download',
        })
      }
      await copyToClipboard(message)
      toast.success('PDF descargado. Mensaje copiado para compartir.')
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, handleUnauthorized, receipt, saleId, whatsAppMessage])

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Ticket 80mm</p>
            <p className="truncate text-xs text-muted-foreground">{receipt?.document.correlativo ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handlePrint} disabled={isLoading || !receipt}>
              Imprimir / Guardar PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleShare} disabled={!receipt}>
              Compartir
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[720px] p-4">
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
      </div>
    </div>
  )
}
