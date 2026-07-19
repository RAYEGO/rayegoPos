import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { salesService } from '@/services/salesService'
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

function normalizeWhatsAppPhone(rawPhone: string) {
  const trimmed = rawPhone.trim()
  if (!trimmed) return null

  const digits = trimmed.replace(/[^\d+]/g, '')
  const withoutPlus = digits.startsWith('+') ? digits.slice(1) : digits
  const normalized = withoutPlus.startsWith('51') ? withoutPlus : `51${withoutPlus}`
  return normalized.replace(/\D/g, '')
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

  const paidAmount = useMemo(
    () => (receipt ? receipt.payments.reduce((sum, payment) => sum + payment.amount, 0) : 0),
    [receipt],
  )

  const whatsappPhone = receipt?.customer?.telefono
    ? normalizeWhatsAppPhone(receipt.customer.telefono)
    : null

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
    window.print()
  }, [])

  const handleShare = useCallback(async () => {
    if (!receipt) return

    const shareUrl = `${window.location.origin}/print/sales/${saleId}`

    const message = whatsAppMessage ?? `Ticket ${receipt.document.correlativo}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ticket ${receipt.document.correlativo}`,
          text: message,
          url: shareUrl,
        })
        return
      } catch {
        return
      }
    }

    if (!whatsappPhone) {
      try {
        await copyToClipboard(shareUrl)
        toast.success('Link del ticket copiado. Adjunta el PDF en WhatsApp.')
      } catch {
        toast.error('No fue posible compartir automáticamente.')
      }
      return
    }

    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [receipt, saleId, whatsappPhone, whatsAppMessage])

  useEffect(() => {
    if (!receipt) return
    if (searchParams.get('share') !== '1') return
    void handleShare()
  }, [handleShare, receipt, searchParams])

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
          <div className="mx-auto w-full max-w-[80mm] rounded-lg border bg-white p-4 text-[11px] leading-tight text-black shadow-sm print:border-0 print:shadow-none">
            <div className="space-y-1 text-center">
              <p className="text-[12px] font-bold">
                {receipt.company.nombreComercial ?? receipt.company.razonSocial}
              </p>
              <p>RUC: {receipt.company.ruc}</p>
              {receipt.company.direccion ? <p>{receipt.company.direccion}</p> : null}
              {receipt.company.telefono ? <p>{receipt.company.telefono}</p> : null}
              <p className="pt-1 font-semibold">{receipt.branch.nombre}</p>
              {receipt.branch.direccion ? <p>{receipt.branch.direccion}</p> : null}
            </div>

            <div className="my-3 border-t border-dashed border-black/60" />

            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">Comprobante</span>
                <span className="font-semibold">{receipt.document.correlativo}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Fecha</span>
                <span>{formatDateTime(receipt.issuedAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Cajero</span>
                <span className="text-right">{receipt.cashierName}</span>
              </div>
              <div className="pt-1">
                <p className="font-semibold">Cliente</p>
                <p>{receipt.customer?.nombre ?? 'Mostrador'}</p>
                {receipt.customer?.numeroDocumento ? (
                  <p>
                    {receipt.customer.tipoDocumento ?? 'DOC'}: {receipt.customer.numeroDocumento}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-black/60" />

            <div className="space-y-2">
              {receipt.items.map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{item.name}</p>
                      <p className="text-[10px]">{item.sku}</p>
                    </div>
                    <p className="whitespace-nowrap font-semibold">{formatCurrency(item.total)}</p>
                  </div>
                  <div className="flex justify-between gap-2 text-[10px]">
                    <p className="text-black/80">
                      {item.quantity} {item.unitSymbol} x {formatCurrency(item.unitPrice)}
                    </p>
                    {item.discountAmount > 0 ? (
                      <p className="text-black/70">Desc: {formatCurrency(item.discountAmount)}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="my-3 border-t border-dashed border-black/60" />

            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span>Subtotal</span>
                <span>{formatCurrency(receipt.totals.subtotal)}</span>
              </div>
              {receipt.totals.discountTotal > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Descuento</span>
                  <span>-{formatCurrency(receipt.totals.discountTotal)}</span>
                </div>
              ) : null}
              {receipt.totals.taxTotal > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Impuestos</span>
                  <span>{formatCurrency(receipt.totals.taxTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2 text-[12px] font-bold">
                <span>Total</span>
                <span>{formatCurrency(receipt.totals.total)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Pagado</span>
                <span>{formatCurrency(paidAmount)}</span>
              </div>
              {receipt.totals.changeAmount > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>Vuelto</span>
                  <span>{formatCurrency(receipt.totals.changeAmount)}</span>
                </div>
              ) : null}
              {receipt.totals.outstandingAmount > 0 ? (
                <div className="flex justify-between gap-2 font-semibold">
                  <span>Pendiente</span>
                  <span>{formatCurrency(receipt.totals.outstandingAmount)}</span>
                </div>
              ) : null}
            </div>

            <div className="my-3 border-t border-dashed border-black/60" />

            <div className="space-y-1">
              <p className="font-semibold">Pagos</p>
              {receipt.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between gap-2">
                  <span>{payment.methodName}</span>
                  <span>{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>

            {receipt.observations ? (
              <>
                <div className="my-3 border-t border-dashed border-black/60" />
                <div className="space-y-1">
                  <p className="font-semibold">Observaciones</p>
                  <p className="break-words">{receipt.observations}</p>
                </div>
              </>
            ) : null}

            <div className="mt-4 text-center">
              <p className="font-semibold">Gracias por su compra</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
