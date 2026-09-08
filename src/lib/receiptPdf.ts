import { jsPDF } from 'jspdf'
import type { SaleReceiptResponse } from '@/types/sales'

type DataUrlInfo = {
  format: 'PNG' | 'JPEG' | 'JPG'
  dataUrl: string
}

function inferDataUrlFormatFromMime(dataUrl: string): 'PNG' | 'JPEG' {
  const header = dataUrl.slice(0, 64).toLowerCase()
  if (header.includes('image/jpeg') || header.includes('image/jpg')) return 'JPEG'
  return 'PNG'
}

async function logoToCompatiblePdfImage(
  logoUrl: string,
  timeoutMs = 6000,
): Promise<DataUrlInfo | null> {
  if (!logoUrl) return null
  const isDataUrl = /^data:image\//i.test(logoUrl.trim())
  if (isDataUrl) {
    const format = inferDataUrlFormatFromMime(logoUrl)
    return { format, dataUrl: logoUrl }
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('timeout-logo-load')), timeoutMs)
    })
    const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => {
        const fallback = new Image()
        fallback.onload = () => resolve(fallback)
        fallback.onerror = () => reject(new Error('no-logo-load'))
        fallback.src = logoUrl
      }
      img.src = logoUrl
    })
    const img = await Promise.race([imgPromise, timeoutPromise])
    const naturalW = Number.isFinite(img.naturalWidth) ? img.naturalWidth : 0
    const naturalH = Number.isFinite(img.naturalHeight) ? img.naturalHeight : 0
    if (!naturalW || !naturalH) return null
    const maxPxW = 240
    const maxPxH = 96
    let w = naturalW
    let h = naturalH
    const rW = maxPxW / w
    const rH = maxPxH / h
    const ratio = Math.min(1, rW, rH)
    w = Math.max(1, Math.round(w * ratio))
    h = Math.max(1, Math.round(h * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    const png = canvas.toDataURL('image/png')
    return { format: 'PNG', dataUrl: png }
  } catch {
    return null
  }
}

export async function createReceiptPdf(receipt: SaleReceiptResponse) {
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

  if (receipt.company.logoUrl) {
    try {
      const logoImg = await logoToCompatiblePdfImage(receipt.company.logoUrl, 6000)
      if (logoImg) {
        const maxLogoW = 60
        const maxLogoH = 12
        const dims =
          typeof (doc as any).getImageProperties === 'function'
            ? ((doc as any).getImageProperties(logoImg.dataUrl) as { width: number; height: number })
            : null
        let w = dims?.width ?? maxLogoW
        let h = dims?.height ?? maxLogoH
        const rW = maxLogoW / w
        const rH = maxLogoH / h
        const ratio = Math.min(1, rW, rH)
        w = Math.max(1, w * ratio)
        h = Math.max(1, h * ratio)
        const x = 40 - w / 2
        doc.addImage(logoImg.dataUrl, logoImg.format, x, y, w, h, undefined, 'FAST')
        y += h + 1
      }
    } catch {
      /* ignore: render sin logo */
    }
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

