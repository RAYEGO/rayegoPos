import { jsPDF } from 'jspdf'
import type { SaleReceiptResponse } from '@/types/sales'

export function createReceiptPdf(receipt: SaleReceiptResponse) {
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

  const addLine = (
    text: string,
    opts?: { bold?: boolean; size?: number; align?: 'left' | 'center' },
  ) => {
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

  addLine(receipt.company.nombreComercial ?? receipt.company.razonSocial, {
    bold: true,
    size: 12,
    align: 'center',
  })
  addLine(`RUC: ${receipt.company.ruc}`, { align: 'center' })
  if (receipt.company.direccion) addLine(receipt.company.direccion, { align: 'center' })
  if (receipt.company.telefono) addLine(receipt.company.telefono, { align: 'center' })
  addLine(receipt.branch.nombre, { bold: true, align: 'center' })
  if (receipt.branch.direccion) addLine(receipt.branch.direccion, { align: 'center' })

  addHr()

  addRow('Comprobante', receipt.document.correlativo, { bold: true })
  addRow(
    'Fecha',
    receipt.issuedAt ? receipt.issuedAt.replace('T', ' ').slice(0, 16) : '—',
  )
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
  if (receipt.totals.discountTotal > 0)
    addRow('Descuento', `-${receipt.totals.discountTotal.toFixed(2)}`)
  if (receipt.totals.taxTotal > 0) addRow('Impuestos', receipt.totals.taxTotal.toFixed(2))
  addRow('Total', receipt.totals.total.toFixed(2), { bold: true, size: 12 })
  if (receipt.totals.changeAmount > 0) addRow('Vuelto', receipt.totals.changeAmount.toFixed(2))
  if (receipt.totals.outstandingAmount > 0)
    addRow('Pendiente', receipt.totals.outstandingAmount.toFixed(2), { bold: true })

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

