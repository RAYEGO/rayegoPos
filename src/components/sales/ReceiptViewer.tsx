import { useMemo } from 'react'
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

export type ReceiptViewerProps = {
  receipt: SaleReceiptResponse
  className?: string
}

export function ReceiptViewer({ receipt, className }: ReceiptViewerProps) {
  const paidAmount = useMemo(
    () => receipt.payments.reduce((sum, payment) => sum + payment.amount, 0),
    [receipt.payments],
  )

  return (
    <div
      className={[
        'mx-auto w-full max-w-[80mm] rounded-lg border bg-white p-4 text-[11px] leading-tight text-black shadow-sm print:border-0 print:shadow-none',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
  )
}

