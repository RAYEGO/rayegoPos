import type { PurchaseOrderDetail } from '@/types/purchases'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'

const MM_TO_PT = 2.8346456693
const A4_WIDTH_MM = 210

const PDF_MARGIN_MM = { top: 12, right: 12, bottom: 14, left: 12 }

const PRINTABLE_WIDTH_MM =
  A4_WIDTH_MM - PDF_MARGIN_MM.left - PDF_MARGIN_MM.right

const PRINTABLE_WIDTH_PX = (PRINTABLE_WIDTH_MM / 25.4) * 96

const STAGING_WIDTH_PX = Math.floor(PRINTABLE_WIDTH_PX)

type ExternalSource =
  | HTMLElement
  | { readonly detail: PurchaseOrderDetail }

async function mountExternalDocument(
  source: ExternalSource,
): Promise<{ readonly node: HTMLElement; readonly cleanup: () => void }> {
  if (source instanceof HTMLElement) {
    return { node: source, cleanup: () => {} }
  }

  const host = document.createElement('div')
  const widthPx = STAGING_WIDTH_PX
  Object.assign(host.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${widthPx}px`,
    height: 'auto',
    background: '#ffffff',
    color: '#0f172a',
    padding: '0px',
    margin: '0px',
    overflow: 'hidden',
    zIndex: '2147483644',
    pointerEvents: 'none',
    display: 'block',
    opacity: '1',
    visibility: 'visible',
    fontFamily:
      'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    boxSizing: 'border-box',
  } as CSSStyleDeclaration)

  document.body.appendChild(host)

  const ReactDOM = await import('react-dom/client')
  const React = await import('react')
  const { PurchaseOrderDocument } = await import(
    '@/components/purchases/PurchaseOrderDocument'
  )

  const root = ReactDOM.createRoot(host)
  await new Promise<void>((resolve) => {
    let raf = 0
    const start = Date.now()
    const loop = () => {
      const docNode = host.querySelector('[data-purchase-order-document]')
      const hasMarkers =
        !!docNode &&
        !!docNode.querySelector(
          '.po-header-block, .po-supplier-block, .po-table, table.po-table, [data-po-block="header"]',
        )
      const hasHeight =
        !!docNode && docNode.getBoundingClientRect().height > 80
      if (docNode && (hasMarkers || hasHeight)) {
        resolve()
        return
      }
      if (Date.now() - start > 5000) {
        resolve()
        return
      }
      raf = window.setTimeout(loop, 60) as unknown as number
    }
    root.render(
      React.createElement(PurchaseOrderDocument, {
        order: source.detail,
        variant: 'external',
      }),
    )
    loop()
    void raf
  })

  await new Promise<void>((resolve) => {
    if (document.fonts && typeof document.fonts.ready === 'object') {
      Promise.resolve(document.fonts.ready).then(() => resolve())
      setTimeout(() => resolve(), 800)
    } else {
      setTimeout(() => resolve(), 500)
    }
  })

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  const docNodeInner = host.querySelector('[data-purchase-order-document]')
  if (docNodeInner) {
    void (docNodeInner as HTMLElement).offsetHeight
  }
  void host.offsetHeight

  const node = host.querySelector(
    '[data-purchase-order-document]',
  ) as HTMLElement | null

  const cleanup = () => {
    try {
      setTimeout(() => {
        try {
          root.unmount()
        } catch {
          /* ignore */
        }
        try {
          if (host.isConnected) host.remove()
        } catch {
          /* ignore */
        }
      }, 4500)
    } catch {
      /* ignore */
    }
  }

  return { node: node ?? host, cleanup }
}

async function mountExternalDocumentDetached(
  source: ExternalSource,
): Promise<{ readonly node: HTMLElement; readonly cleanup: () => void }> {
  if (source instanceof HTMLElement) {
    return { node: source, cleanup: () => {} }
  }
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${STAGING_WIDTH_PX}px`,
    height: 'auto',
    background: '#ffffff',
    color: '#0f172a',
    padding: '0px',
    margin: '0px',
    overflow: 'hidden',
    zIndex: '2147483644',
    pointerEvents: 'none',
    display: 'block',
    opacity: '1',
    visibility: 'visible',
    fontFamily:
      'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    boxSizing: 'border-box',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)

  const ReactDOM = await import('react-dom/client')
  const React = await import('react')
  const { PurchaseOrderDocument } = await import(
    '@/components/purchases/PurchaseOrderDocument'
  )

  const root = ReactDOM.createRoot(host)
  await new Promise<void>((resolve) => {
    const start = Date.now()
    const loop = () => {
      const doc = host.querySelector('[data-purchase-order-document]')
      if (doc && doc.querySelector('.po-header-block, .po-supplier-block, .po-table, table.po-table, [data-po-block="header"]')) {
        resolve()
        return
      }
      if (Date.now() - start > 5000) {
        resolve()
        return
      }
      window.setTimeout(loop, 60)
    }
    root.render(
      React.createElement(PurchaseOrderDocument, {
        order: source.detail,
        variant: 'external',
      }),
    )
    loop()
  })

  await new Promise<void>((resolve) => {
    if (document.fonts && typeof document.fonts.ready === 'object') {
      Promise.resolve(document.fonts.ready).then(() => resolve())
      setTimeout(() => resolve(), 700)
    } else {
      setTimeout(() => resolve(), 450)
    }
  })

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  const detachedDoc = host.querySelector('[data-purchase-order-document]')
  if (detachedDoc) void (detachedDoc as HTMLElement).offsetHeight
  void host.offsetHeight

  const docNode = host.querySelector(
    '[data-purchase-order-document]',
  ) as HTMLElement | null
  const node = (docNode ?? host).cloneNode(true) as HTMLElement

  const cleanup = () => {
    setTimeout(() => {
      try {
        root.unmount()
      } catch {
        /* ignore */
      }
      try {
        if (host.isConnected) host.remove()
      } catch {
        /* ignore */
      }
    }, 10)
  }
  return { node, cleanup }
}

export async function printPurchaseOrderFromElement(
  element: HTMLElement,
  options?: { title?: string },
): Promise<void>
export async function printPurchaseOrderFromElement(
  source: { readonly detail: PurchaseOrderDetail },
  options?: { title?: string },
): Promise<void>
export async function printPurchaseOrderFromElement(
  source: HTMLElement | { readonly detail: PurchaseOrderDetail },
  options?: { title?: string },
): Promise<void> {
  const title = options?.title?.trim() || 'Orden de compra'
  const { node, cleanup } = await mountExternalDocumentDetached(source)
  try {
    const printWindow = window.open(
      '',
      '_blank',
      'width=900,height=1200',
    )
    if (!printWindow) {
      toast.warning('Bloqueaste la ventana emergente para imprimir.')
      cleanup()
      return
    }

    const cloned = node.cloneNode(true) as HTMLElement
    const style = `
      @page {
        size: A4 portrait;
        margin: ${PDF_MARGIN_MM.top}mm ${PDF_MARGIN_MM.right}mm ${PDF_MARGIN_MM.bottom}mm ${PDF_MARGIN_MM.left}mm;
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          font-size: 10px;
          color: #64748b;
        }
      }
      html, body { background: #ffffff !important; color: #0f172a; margin: 0 !important; padding: 0 !important; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      *, *::before, *::after { box-sizing: border-box; }
      [data-purchase-order-document] {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        overflow-wrap: anywhere !important;
        word-wrap: break-word !important;
        word-break: break-word !important;
      }
      [data-order-internal-only] { display: none !important; }
      .po-row { page-break-inside: avoid; break-inside: avoid; }
      .po-block-totals-notes, .po-totals-section, .po-notes-section, .po-supplier-block, .po-header-block { page-break-inside: avoid; break-inside: avoid; }
      .po-table {
        page-break-inside: auto;
        border-collapse: collapse !important;
        width: 100% !important;
        table-layout: fixed !important;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .po-table thead { display: table-header-group; }
      .po-table tfoot { display: table-footer-group; }
      .po-table th, .po-table td {
        page-break-inside: avoid;
        break-inside: avoid;
        overflow-wrap: anywhere;
        word-break: break-word;
        vertical-align: top;
      }
      .po-col-product { width: 36%; }
      .po-col-presentation { width: 11%; }
      .po-col-qty { width: 9%; }
      .po-col-cost { width: 13%; }
      .po-col-tax { width: 8%; }
      .po-col-total { width: 13%; }
    `
    printWindow.document.open()
    printWindow.document.write(
      `<!doctype html><html><head><title>${title}</title><style>${style}</style></head><body></body></html>`,
    )
    printWindow.document.body.appendChild(cloned)
    printWindow.document.close()
    printWindow.focus()
    await new Promise<void>((resolve) => {
      const resolved = { value: false }
      const done = () => {
        if (resolved.value) return
        resolved.value = true
        resolve()
      }
      printWindow.addEventListener('load', done, { once: true })
      setTimeout(done, 1200)
    })
    try {
      printWindow.print()
    } catch (err) {
      console.error(err)
    }
  } finally {
    cleanup()
  }
}

export async function generatePurchaseOrderPDFBlob(
  element: HTMLElement,
  options?: { filename?: string },
): Promise<Blob | null>
export async function generatePurchaseOrderPDFBlob(
  source: { readonly detail: PurchaseOrderDetail },
  options?: { filename?: string },
): Promise<Blob | null>
export async function generatePurchaseOrderPDFBlob(
  source: ExternalSource,
  options?: { filename?: string },
): Promise<Blob | null> {
  const overlay = document.createElement('div')
  overlay.setAttribute('data-pdf-staging-overlay', '')
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '100vw',
    height: '100vh',
    background: '#ffffff',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '1',
    visibility: 'visible',
  } as CSSStyleDeclaration)
  document.body.appendChild(overlay)

  let sourceCleanupFinal: () => void = () => {}
  const host = document.createElement('div')
  host.setAttribute('data-pdf-staging-host', '')
  try {
    const { node: sourceNode, cleanup: sourceCleanup } =
      await mountExternalDocument(source)
    sourceCleanupFinal = sourceCleanup

    if (!sourceNode) {
      toast.error('No se encontró el contenido de la orden de compra.')
      return null
    }

    const widthPx = STAGING_WIDTH_PX
    Object.assign(host.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${widthPx}px`,
      height: 'auto',
      background: '#ffffff',
      color: '#0f172a',
      padding: '0px',
      margin: '0px',
      overflow: 'hidden',
      zIndex: '2147483646',
      pointerEvents: 'none',
      display: 'block',
      opacity: '1',
      visibility: 'visible',
      fontFamily:
        'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      boxSizing: 'border-box',
    } as CSSStyleDeclaration)

  const css = document.createElement('style')
  css.textContent = `
    [data-pdf-staging-host], [data-pdf-staging-host] * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      overflow-wrap: anywhere !important;
      word-wrap: break-word !important;
      word-break: break-word !important;
    }
    [data-pdf-staging-host] > * { width: 100% !important; height: auto !important; }
    [data-pdf-staging-host] [data-purchase-order-document] {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
    }
    [data-pdf-staging-host] [data-order-internal-only] { display: none !important; }
    [data-pdf-staging-host] .po-row { page-break-inside: avoid; break-inside: avoid; }
    [data-pdf-staging-host] .po-block-totals-notes,
    [data-pdf-staging-host] .po-totals-section,
    [data-pdf-staging-host] .po-notes-section,
    [data-pdf-staging-host] .po-supplier-block,
    [data-pdf-staging-host] .po-header-block { page-break-inside: avoid; break-inside: avoid; }
    [data-pdf-staging-host] .po-notes-section + * { page-break-before: avoid !important; }
    [data-pdf-staging-host] .po-table {
      page-break-inside: auto;
      border-collapse: collapse !important;
      width: 100% !important;
      table-layout: fixed !important;
    }
    [data-pdf-staging-host] .po-table thead { display: table-header-group; }
    [data-pdf-staging-host] .po-table tfoot { display: table-footer-group; }
    [data-pdf-staging-host] .po-table th,
    [data-pdf-staging-host] .po-table td {
      page-break-inside: avoid;
      break-inside: avoid;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    [data-pdf-staging-host] .po-col-product { width: 36%; }
    [data-pdf-staging-host] .po-col-presentation { width: 11%; }
    [data-pdf-staging-host] .po-col-qty { width: 9%; }
    [data-pdf-staging-host] .po-col-cost { width: 13%; }
    [data-pdf-staging-host] .po-col-tax { width: 8%; }
    [data-pdf-staging-host] .po-col-total { width: 13%; }
  `

  const clone = sourceNode.cloneNode(true) as HTMLElement
  host.appendChild(css)
  host.appendChild(clone)
  document.body.appendChild(host)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  void host.offsetHeight

    const MARGIN_TOP_PT = PDF_MARGIN_MM.top * MM_TO_PT
    const MARGIN_RIGHT_PT = PDF_MARGIN_MM.right * MM_TO_PT
    const MARGIN_LEFT_PT = PDF_MARGIN_MM.left * MM_TO_PT
    const PRINTABLE_WIDTH_PT =
      A4_WIDTH_MM * MM_TO_PT - MARGIN_LEFT_PT - MARGIN_RIGHT_PT
    const PRINTABLE_HEIGHT_MM_ACTUAL =
      297 - PDF_MARGIN_MM.top - PDF_MARGIN_MM.bottom
    const PRINTABLE_CSS_HEIGHT_PX =
      (PRINTABLE_HEIGHT_MM_ACTUAL / 25.4) * 96
    const SCALE = 2
    const PRINTABLE_SCALED_HEIGHT = PRINTABLE_CSS_HEIGHT_PX * SCALE
    const PRINTABLE_SCALED_WIDTH = widthPx * SCALE

    await new Promise<void>((resolve) => {
      if (document.fonts && typeof document.fonts.ready === 'object') {
        Promise.resolve(document.fonts.ready).then(() => resolve())
        setTimeout(() => resolve(), 700)
      } else {
        setTimeout(() => resolve(), 500)
      }
    })

    const hostRect = host.getBoundingClientRect()
    let hostHeight = hostRect.height
    if (!Number.isFinite(hostHeight) || hostHeight < 20) {
      console.warn(
        '[purchaseDocument] El staging host tiene una altura menor a 20px. Forzando reflow antes de capturar.',
        { hostHeight },
      )
      host.style.width = `${widthPx}px`
      void host.offsetHeight
      hostHeight = host.getBoundingClientRect().height
    }

    const notesBlock = host.querySelector('.po-block-totals-notes') as HTMLElement | null
    if (notesBlock) {
      const notesRect = notesBlock.getBoundingClientRect()
      const notesTopInHost = notesRect.top - hostRect.top
      const notesHeight = notesRect.height
      const usableOnePage = PRINTABLE_CSS_HEIGHT_PX
      const notesEndInHost = notesTopInHost + notesHeight
      const notesOverlapBottom =
        notesTopInHost < usableOnePage && notesEndInHost > usableOnePage
      const notesNearBottom =
        notesTopInHost > usableOnePage * 0.78 && notesEndInHost > usableOnePage
      if (notesOverlapBottom || notesNearBottom) {
        const pushBy = Math.max(0, usableOnePage - notesTopInHost) + 10
        host.style.height = `${hostHeight + pushBy}px`
        host.style.paddingBottom = `${pushBy}px`
        notesBlock.style.marginTop = '10px'
        void host.offsetHeight
      }
    }

    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: SCALE,
      width: widthPx,
      windowWidth: widthPx,
      useCORS: true,
      logging: false,
      imageTimeout: 15000,
      allowTaint: false,
      foreignObjectRendering: false,
    })

    let scaledCanvas = canvas
    if (canvas.width !== PRINTABLE_SCALED_WIDTH || canvas.height < canvas.width) {
      const canvasW = canvas.width
      if (canvasW !== PRINTABLE_SCALED_WIDTH && canvasW > 0) {
        const ratio = PRINTABLE_SCALED_WIDTH / canvasW
        const newH = Math.max(1, Math.ceil(canvas.height * ratio))
        const tmp = document.createElement('canvas')
        tmp.width = PRINTABLE_SCALED_WIDTH
        tmp.height = newH
        const tctx = tmp.getContext('2d')!
        tctx.fillStyle = '#ffffff'
        tctx.fillRect(0, 0, tmp.width, tmp.height)
        tctx.imageSmoothingEnabled = true
        tctx.imageSmoothingQuality = 'high'
        tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height)
        scaledCanvas = tmp
      }
    }

    const totalFullPages = Math.max(
      1,
      Math.ceil(scaledCanvas.height / PRINTABLE_SCALED_HEIGHT),
    )
    const pageImages: string[] = []
    const pageHeightsPx: number[] = []
    for (let p = 0; p < totalFullPages; p++) {
      const yStart = p * PRINTABLE_SCALED_HEIGHT
      let yEnd = yStart + PRINTABLE_SCALED_HEIGHT
      let actualChunkHeightScaled = PRINTABLE_SCALED_HEIGHT
      if (yEnd > scaledCanvas.height) {
        yEnd = scaledCanvas.height
        actualChunkHeightScaled = Math.max(1, yEnd - yStart)
      }
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = scaledCanvas.width
      pageCanvas.height = actualChunkHeightScaled
      const pctx = pageCanvas.getContext('2d')!
      pctx.fillStyle = '#ffffff'
      pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      pctx.drawImage(scaledCanvas, 0, -yStart)
      pageImages.push(pageCanvas.toDataURL('image/png'))
      pageHeightsPx.push(actualChunkHeightScaled)
    }

    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    })
    const totalPages = pageImages.length
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) doc.addPage()
      const chunkHeightScaled = pageHeightsPx[i]
      const displayedHeightPt =
        (chunkHeightScaled / scaledCanvas.width) * PRINTABLE_WIDTH_PT
      doc.addImage(
        pageImages[i],
        'PNG',
        MARGIN_LEFT_PT,
        MARGIN_TOP_PT,
        PRINTABLE_WIDTH_PT,
        displayedHeightPt,
      )
    }

    if (totalPages > 1) {
      doc.setFont('helvetica')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum)
        const pageHeight = doc.internal.pageSize.getHeight()
        const pageWidth = doc.internal.pageSize.getWidth()
        const label = `Página ${pageNum} de ${totalPages}`
        const textWidth = doc.getTextWidth(label)
        doc.text(
          label,
          pageWidth - MARGIN_RIGHT_PT - textWidth,
          pageHeight - (PDF_MARGIN_MM.bottom * MM_TO_PT) / 2,
        )
      }
    }

    const blob = (await doc.output('blob')) as Blob
    if (options?.filename) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = options.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2500)
    }
    return blob
  } catch (err) {
    console.error('Error generando PDF de orden de compra:', err)
    toast.error('No se pudo generar el PDF. Intenta Imprimir > Guardar como PDF.')
    return null
  } finally {
    setTimeout(() => {
      try {
        if (overlay.isConnected) overlay.remove()
      } catch { /* ignore */ }
      try {
        const staleOverlay = document.querySelector('[data-pdf-staging-overlay]')
        if (staleOverlay && staleOverlay.isConnected) staleOverlay.remove()
      } catch { /* ignore */ }
      try {
        if (host.isConnected) host.remove()
      } catch {
        /* ignore */
      }
      try { sourceCleanupFinal() } catch { /* ignore */ }
    }, 10)
  }
}

export function copyPurchaseOrderText(order: {
  code: string
  supplierName: string
  fechaEmision: string | null
  fechaRecepcionEsperada: string | null
  branchName: string
  items: Array<{
    productName: string
    sku: string
    presentationName: string
    presentationQuantity: number
    unitCostPresentation: number
    taxRate: number
    total: number
  }>
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  observaciones: string | null
}) {
  const lines: string[] = []
  lines.push(`ORDEN DE COMPRA ${order.code}`)
  lines.push(`Proveedor: ${order.supplierName}`)
  lines.push(`Emisión: ${order.fechaEmision || '-'} · Recepción esperada: ${order.fechaRecepcionEsperada || '-'}`)
  lines.push(`Sucursal: ${order.branchName}`)
  lines.push('')
  lines.push('Productos:')
  order.items.forEach((it, idx) => {
    lines.push(
      `${idx + 1}. ${it.productName} (${it.sku}) · ${it.presentationQuantity} ${it.presentationName} · Subtotal S/ ${Number(it.total).toFixed(2)}`,
    )
  })
  lines.push('')
  lines.push(`Subtotal: S/ ${order.subtotalAmount.toFixed(2)}`)
  lines.push(`IGV: S/ ${order.taxAmount.toFixed(2)}`)
  lines.push(`Total: S/ ${order.totalAmount.toFixed(2)}`)
  if (order.observaciones?.trim()) {
    lines.push('')
    lines.push(`Observaciones: ${order.observaciones.trim()}`)
  }

  return lines.join('\n')
}

export async function sharePurchaseOrder(options: {
  orderCode: string
  supplierName: string
  pdfBlob: Blob | null
  textSummary: string
  onDownload: () => Promise<Blob | null>
  onPrint: () => void
}) {
  const { orderCode, supplierName, pdfBlob, textSummary, onDownload, onPrint } = options

  const nav = navigator as Navigator & {
    share?: (data: ShareData & { files?: File[] }) => Promise<void>
    canShare?: (data: ShareData & { files?: File[] }) => boolean
  }

  const title = `Orden de compra ${orderCode}`
  const text = `Orden de compra ${orderCode} para ${supplierName}`

  let finalBlob = pdfBlob
  try {
    if (nav.share) {
      if (!finalBlob) {
        try {
          finalBlob = await onDownload()
        } catch (e) {
          console.warn('[sharePurchaseOrder] onDownload falló antes de share:', e)
        }
      }
      const files: File[] = []
      if (finalBlob) {
        const file = new File(
          [finalBlob],
          `orden-de-compra-${orderCode.toLowerCase()}.pdf`,
          { type: 'application/pdf' },
        )
        files.push(file)
      }
      if (nav.canShare && files.length && nav.canShare({ files, title, text })) {
        await nav.share({ files, title, text })
        toast.success('Orden compartida.')
        return
      }
      if (files.length && nav.share) {
        try {
          await nav.share({ files, title, text })
          toast.success('Orden compartida.')
          return
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || /cancel/i.test(err.message))) {
      return
    }
    console.error('[sharePurchaseOrder] share falló:', err)
    /* else, fallback */
  }

  // Fallback: menú simple de alternativas
  const sharePanel = document.createElement('div')
  sharePanel.className =
    'fixed right-4 bottom-4 z-[9999] w-[320px] rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 space-y-2'
  sharePanel.setAttribute('role', 'dialog')
  sharePanel.innerHTML = `
    <div class="flex items-start justify-between gap-3 mb-1">
      <div>
        <div class="font-semibold text-slate-900">Compartir orden</div>
        <div class="text-xs text-slate-500">Elige una alternativa para enviar la orden.</div>
      </div>
      <button class="text-slate-400 hover:text-slate-600" aria-label="Cerrar">✕</button>
    </div>
    <button data-act="download" class="w-full text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2">
      <div class="font-medium text-slate-900 text-sm">Descargar PDF</div>
      <div class="text-xs text-slate-500">Archivo PDF para adjuntar en correos o mensajería.</div>
    </button>
    <button data-act="print" class="w-full text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2">
      <div class="font-medium text-slate-900 text-sm">Imprimir</div>
      <div class="text-xs text-slate-500">Imprime física o guarda como PDF desde el sistema.</div>
    </button>
    <button data-act="copy" class="w-full text-left rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2">
      <div class="font-medium text-slate-900 text-sm">Copiar resumen</div>
      <div class="text-xs text-slate-500">Pega el detalle en WhatsApp o cualquier chat.</div>
    </button>
  `
  document.body.appendChild(sharePanel)
  const remove = () => sharePanel.remove()
  const closeBtn = sharePanel.querySelector('button[aria-label]') as HTMLButtonElement | null
  closeBtn?.addEventListener('click', remove)
  setTimeout(() => {
    remove()
  }, 9000)

  const dl = sharePanel.querySelector('[data-act="download"]') as HTMLButtonElement
  dl?.addEventListener('click', async () => {
    remove()
    const blob = finalBlob || (await onDownload())
    if (!blob) return
    finalBlob = blob
    const file = new File([blob], `orden-de-compra-${orderCode.toLowerCase()}.pdf`, {
      type: 'application/pdf',
    })
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2500)
    toast.success('PDF descargado.')
  })

  const pr = sharePanel.querySelector('[data-act="print"]') as HTMLButtonElement
  pr?.addEventListener('click', () => {
    remove()
    onPrint()
  })

  const cp = sharePanel.querySelector('[data-act="copy"]') as HTMLButtonElement
  cp?.addEventListener('click', async () => {
    remove()
    try {
      await navigator.clipboard.writeText(textSummary)
      toast.success('Resumen copiado al portapapeles.')
    } catch {
      toast.error('No se pudo copiar.')
    }
  })
}
