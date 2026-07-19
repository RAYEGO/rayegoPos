import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
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

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

function createReceiptPdf(receipt: SaleReceiptResponse) {
  const pageHeight = 297
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, pageHeight],
    compress: true,
  })

  const marginX = 4
  const maxWidth = 80 - marginX * 2
  const rightX = 80 - marginX
  let y = 6

  const addLine = (text: string, opts?: { bold?: boolean; size?: number; align?: 'left' | 'center' }) => {
    const size = opts?.size ?? 10
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
    doc.setFontSize(size)

    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    for (const line of lines) {
      if (y > pageHeight - 10) {
        doc.addPage()
        y = 6
      }

      if (opts?.align === 'center') {
        doc.text(line, 40, y, { align: 'center' })
      } else {
        doc.text(line, marginX, y)
      }
      y += size * 0.45 + 1.2
    }
  }

  const addRow = (left: string, right: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 10
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
    doc.setFontSize(size)

    if (y > pageHeight - 10) {
      doc.addPage()
      y = 6
    }

    doc.text(left, marginX, y)
    doc.text(right, rightX, y, { align: 'right' })
    y += size * 0.45 + 1.6
  }

  const addHr = () => {
    if (y > pageHeight - 10) {
      doc.addPage()
      y = 6
    }
    doc.setDrawColor(0)
    doc.setLineWidth(0.2)
    doc.line(marginX, y, rightX, y)
    y += 4
  }

  addLine(receipt.company.nombreComercial ?? receipt.company.razonSocial, { bold: true, size: 12, align: 'center' })
  addLine(`RUC: ${receipt.company.ruc}`, { align: 'center' })
  if (receipt.company.direccion) addLine(receipt.company.direccion, { align: 'center' })
  if (receipt.company.telefono) addLine(receipt.company.telefono, { align: 'center' })
  addLine(receipt.branch.nombre, { bold: true, align: 'center' })
  if (receipt.branch.direccion) addLine(receipt.branch.direccion, { align: 'center' })

  addHr()

  addRow('Comprobante', receipt.document.correlativo, { bold: true })
  addRow('Fecha', receipt.issuedAt ? receipt.issuedAt.replace('T', ' ').slice(0, 16) : '—')
  addRow('Cajero', receipt.cashierName)
  addLine('Cliente', { bold: true })
  addLine(receipt.customer?.nombre ?? 'Mostrador')
  if (receipt.customer?.numeroDocumento) {
    addLine(`${receipt.customer.tipoDocumento ?? 'DOC'}: ${receipt.customer.numeroDocumento}`)
  }

  addHr()

  for (const item of receipt.items) {
    addLine(item.name, { bold: true })
    addLine(item.sku, { size: 9 })
    const qty = Number.isFinite(item.quantity) ? item.quantity : 0
    addRow(`${qty} ${item.unitSymbol} x ${item.unitPrice.toFixed(2)}`, item.total.toFixed(2))
    if (item.discountAmount > 0) {
      addRow('Descuento', `-${item.discountAmount.toFixed(2)}`)
    }
    y += 1
  }

  addHr()

  addRow('Subtotal', receipt.totals.subtotal.toFixed(2))
  if (receipt.totals.discountTotal > 0) addRow('Descuento', `-${receipt.totals.discountTotal.toFixed(2)}`)
  if (receipt.totals.taxTotal > 0) addRow('Impuestos', receipt.totals.taxTotal.toFixed(2))
  addRow('Total', receipt.totals.total.toFixed(2), { bold: true, size: 12 })
  if (receipt.totals.changeAmount > 0) addRow('Vuelto', receipt.totals.changeAmount.toFixed(2))
  if (receipt.totals.outstandingAmount > 0) addRow('Pendiente', receipt.totals.outstandingAmount.toFixed(2), { bold: true })

  addHr()

  addLine('Pagos', { bold: true })
  for (const payment of receipt.payments) {
    addRow(payment.methodName, payment.amount.toFixed(2))
  }

  if (receipt.observations) {
    addHr()
    addLine('Observaciones', { bold: true })
    addLine(receipt.observations)
  }

  addHr()
  addLine('Gracias por su compra', { bold: true, align: 'center' })

  return doc.output('blob')
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

      await copyToClipboard(message)
      toast.success('PDF descargado. Mensaje copiado para compartir.')
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }, [handleUnauthorized, receipt, whatsAppMessage])

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
