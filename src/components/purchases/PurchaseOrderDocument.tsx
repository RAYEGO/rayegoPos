import { useMemo } from 'react'
import {
  buildPackagingSummary,
  buildPurchasePresentationChain,
  resolveLabelForPresentationId,
  type PurchasePresentationOption,
} from '@/utils/packaging'
import type { PurchaseOrderDetail } from '@/types/purchases'
import { formatCurrency, formatQuantity as formatQty } from '@/lib/utils'

type Variant = 'external' | 'internal-preview'

type Props = {
  order: PurchaseOrderDetail
  variant?: Variant
}

function multiplyEquivalence(equivalenceText: string, qty: number): string {
  if (!equivalenceText || qty === 1) return equivalenceText
  return equivalenceText
    .split(' = ')
    .map((segment) => {
      const match = segment.match(/^([\d.,]+)\s(.*)$/)
      if (!match) return segment
      const num = Number(match[1].replace(/,/g, ''))
      return `${(num * qty).toLocaleString('es-PE')} ${match[2]}`
    })
    .join(' = ')
}

function resolvePurchasePresentationOptions(
  packaging: PurchaseOrderDetail['items'][number]['packaging'],
): PurchasePresentationOption[] | null {
  if (!packaging) return null
  if (!Array.isArray(packaging.presentations)) return null
  return packaging.presentations.map((item) => ({
    id: item.id,
    name: item.name,
    isBase: Boolean(item.isBase),
    allowsPurchase: Boolean(item.allowsPurchase),
    factorToBase: typeof item.factorToBase === 'number' && Number.isFinite(item.factorToBase) ? item.factorToBase : null,
  }))
}

export function PurchaseOrderDocument({ order, variant = 'external' }: Props) {
  const companyName = order.company.nombreComercial || order.company.razonSocial
  const currency = order.company.monedaBase || 'PEN'
  const documentTitle = `ORDEN DE COMPRA - ${order.order.code}`

  const rowsForTable = useMemo(
    () =>
      order.items.map((item) => {
        const options = resolvePurchasePresentationOptions(item.packaging)
        const chain = buildPurchasePresentationChain(options, item.presentationId)
        const labelFn = (id?: string | null) => {
          const label = resolveLabelForPresentationId(options ?? [], id ?? null)
          return label || item.unitSymbol
        }
        const summary = buildPackagingSummary(chain, labelFn)
        const qty = item.presentationQuantity || item.baseQuantity
        const equivalenceText = multiplyEquivalence(summary.equivalenceText, qty)

        return {
          ...item,
          equivalence: summary.hasEnoughData ? equivalenceText : '',
          presentationLabel:
            resolveLabelForPresentationId(options ?? [], item.presentationId) ||
            item.presentationName ||
            item.unitSymbol,
        }
      }),
    [order.items],
  )

  const isInternal = variant === 'internal-preview'
  const PDF_MARGIN_MM = { top: 12, right: 12, bottom: 14, left: 12 }
  const hasObservaciones = Boolean(order.observaciones?.trim())

  return (
    <div
      data-purchase-order-document
      className="w-full bg-white text-slate-900"
      style={{
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        color: '#0f172a',
      }}
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${PDF_MARGIN_MM.top}mm ${PDF_MARGIN_MM.right}mm ${PDF_MARGIN_MM.bottom}mm ${PDF_MARGIN_MM.left}mm;
        }
        @media print {
          html, body { background: #ffffff !important; color: #0f172a; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          *, *::before, *::after { box-sizing: border-box; }
          [data-purchase-order-document] {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            overflow-wrap: anywhere !important;
            word-wrap: break-word !important;
            word-break: break-word !important;
          }
          [data-order-internal-only] { display: none !important; }
          .po-row { page-break-inside: avoid; break-inside: avoid; }
          .po-header-block, .po-supplier-block, .po-totals-section, .po-notes-section, .po-block-totals-notes { page-break-inside: avoid; break-inside: avoid; }
          .po-block-totals-notes + * { page-break-before: avoid !important; }
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
            vertical-align: top;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .po-col-product { width: 36% !important; }
          .po-col-presentation { width: 11% !important; }
          .po-col-qty { width: 9% !important; }
          .po-col-cost { width: 13% !important; }
          .po-col-tax { width: 8% !important; }
          .po-col-total { width: 13% !important; }
        }
        .po-table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
        }
        .po-table th, .po-table td {
          page-break-inside: avoid;
          break-inside: avoid;
          vertical-align: top;
          overflow-wrap: anywhere;
          word-wrap: break-word;
          word-break: break-word;
        }
        .po-col-product { width: 36% !important; }
        .po-col-presentation { width: 11% !important; }
        .po-col-qty { width: 9% !important; }
        .po-col-cost { width: 13% !important; }
        .po-col-tax { width: 8% !important; }
        .po-col-total { width: 13% !important; }
      `}</style>

      {/* HEADER */}
      <div className="po-header-block" style={{ marginBottom: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top', width: '55%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {order.company.logoUrl ? (
                    <img
                      src={order.company.logoUrl}
                      alt="Logo de la empresa"
                      title="Logo de la empresa"
                      onError={(event) => {
                        const el = event.currentTarget as HTMLImageElement
                        el.style.display = 'none'
                      }}
                      style={{
                        height: 48,
                        width: 48,
                        objectFit: 'contain',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        padding: 4,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 48,
                        width: 48,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg,#0284c7,#4f46e5)',
                        color: 'white',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {companyName ? companyName.trim().charAt(0).toUpperCase() : 'RB'}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15, color: '#0f172a', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {companyName}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#334155', marginTop: 2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {order.company.razonSocial}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      RUC {order.company.numeroDocumento}
                      {order.company.direccion ? ` · ${order.company.direccion}` : ''}
                      {order.company.telefono ? ` · ${order.company.telefono}` : ''}
                      {order.company.email ? ` · ${order.company.email}` : ''}
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ verticalAlign: 'top', width: '45%', textAlign: 'right' }}>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: 8,
                    display: 'inline-block',
                    textAlign: 'left',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      color: '#64748b',
                      marginBottom: 2,
                    }}
                  >
                    {documentTitle}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2, color: '#0f172a', lineHeight: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {order.order.code}
                  </div>
                  <table style={{ width: '100%', marginTop: 6, fontSize: 10.5, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '36%', color: '#64748b', padding: '1.5px 0', verticalAlign: 'top' }}>Emisión</td>
                        <td style={{ width: '64%', color: '#0f172a', fontWeight: 600, padding: '1.5px 0', verticalAlign: 'top', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {order.fechaEmision || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: '#64748b', padding: '1.5px 0', verticalAlign: 'top' }}>Recepción</td>
                        <td style={{ color: '#0f172a', fontWeight: 600, padding: '1.5px 0', verticalAlign: 'top', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {order.fechaRecepcionEsperada || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: '#64748b', padding: '1.5px 0', verticalAlign: 'top' }}>Sucursal</td>
                        <td style={{ color: '#0f172a', fontWeight: 600, padding: '1.5px 0', verticalAlign: 'top', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {order.branch.nombre}
                        </td>
                      </tr>
                      {isInternal ? (
                        <tr data-order-internal-only>
                          <td style={{ color: '#64748b', padding: '1.5px 0' }}>Responsable</td>
                          <td style={{ color: '#0f172a', fontWeight: 600, padding: '1.5px 0' }}>
                            {order.buyer.fullName}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PROVEEDOR */}
      <div
        className="po-supplier-block"
        style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '8px 0', marginBottom: 10 }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={{ width: '62%', verticalAlign: 'top' }}>
                <div
                  style={{
                    fontSize: 8.5,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    marginBottom: 3,
                  }}
                >
                  Proveedor
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {order.supplier.razonSocial}
                </div>
                <div style={{ fontSize: 10.5, color: '#334155', marginTop: 3, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  RUC {order.supplier.numeroDocumento}
                </div>
              </td>
              {isInternal ? (
                <td data-order-internal-only style={{ width: '38%', verticalAlign: 'top', textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      color: '#64748b',
                      marginBottom: 3,
                    }}
                  >
                    Estado
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 11,
                      fontWeight: 600,
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    {order.order.status}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4 }}>
                    Logístico {order.order.logisticsStatus} · Financiero {order.order.financialStatus}
                  </div>
                </td>
              ) : null}
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <table className="po-table" style={{ width: '100%', marginBottom: 10 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <th
              className="po-col-product"
              style={{
                textAlign: 'left',
                padding: '6px 6px',
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              Producto
            </th>
            <th
              className="po-col-presentation"
              style={{
                textAlign: 'left',
                padding: '6px 5px',
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              Presentación
            </th>
            <th
              className="po-col-qty"
              style={{
                textAlign: 'right',
                padding: '6px 5px',
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              Cantidad
            </th>
            <th
              className="po-col-cost"
              style={{
                textAlign: 'right',
                padding: '6px 5px',
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              Costo unitario
            </th>
            <th
              className="po-col-tax"
              style={{
                textAlign: 'center',
                padding: '6px 5px',
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              IGV
            </th>
            <th
              className="po-col-total"
              style={{
                textAlign: 'right',
                padding: '6px 5px',
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rowsForTable.map((row, idx) => (
            <tr
              key={row.detailId}
              className="po-row"
              style={{
                borderBottom:
                  idx !== rowsForTable.length - 1 ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                verticalAlign: 'top',
              }}
            >
              <td className="po-col-product" style={{ padding: '5px 6px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {row.productName}
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  SKU {row.sku}
                </div>
                {row.equivalence ? (
                  <div style={{ fontSize: 9.5, color: '#334155', marginTop: 2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {row.equivalence}
                  </div>
                ) : null}
              </td>
              <td className="po-col-presentation" style={{ padding: '5px 5px', fontSize: 11, color: '#0f172a', verticalAlign: 'top', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {row.presentationLabel}
              </td>
              <td
                className="po-col-qty"
                style={{
                  padding: '5px 5px',
                  textAlign: 'right',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0f172a',
                  verticalAlign: 'top',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatQty(row.presentationQuantity)}
              </td>
              <td
                className="po-col-cost"
                style={{
                  padding: '5px 5px',
                  textAlign: 'right',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#0f172a',
                  verticalAlign: 'top',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(row.unitCostPresentation, currency)}
              </td>
              <td
                className="po-col-tax"
                style={{
                  padding: '5px 5px',
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#0f172a',
                  verticalAlign: 'top',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Number.isFinite(row.taxRate) ? `${row.taxRate.toFixed(0)}%` : '0%'}
              </td>
              <td
                className="po-col-total"
                style={{
                  padding: '5px 5px',
                  textAlign: 'right',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#0f172a',
                  verticalAlign: 'top',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(row.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* OBSERVACIONES + TOTALES juntos en bloque no cortable */}
      <div className="po-block-totals-notes">
        <table className="po-totals-section" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: 8 }}>
          <tbody>
            <tr>
              {hasObservaciones ? (
                <td className="po-notes-section" style={{ width: '58%', verticalAlign: 'top', paddingRight: 14 }}>
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      color: '#64748b',
                      marginBottom: 3,
                    }}
                  >
                    Observaciones
                  </div>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 5,
                      background: '#fafafa',
                      padding: '6px 8px',
                      fontSize: 10.5,
                      color: '#0f172a',
                      minHeight: 52,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.35,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {order.observaciones?.trim() || ''}
                  </div>
                  {isInternal ? (
                    <div data-order-internal-only style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 6 }}>
                      Esta orden de compra no afecta el inventario hasta que se confirme la recepción de la mercadería.
                    </div>
                  ) : null}
                </td>
              ) : null}
              <td style={{ width: hasObservaciones ? '42%' : '100%', verticalAlign: 'top' }}>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 5,
                    padding: 8,
                    background: '#fafafa',
                  }}
                >
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 2px', color: '#475569' }}>Subtotal</td>
                        <td
                          style={{
                            padding: '2px 2px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#0f172a',
                          }}
                        >
                          {formatCurrency(order.order.subtotalAmount, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 2px', color: '#475569' }}>IGV total</td>
                        <td
                          style={{
                            padding: '2px 2px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#0f172a',
                          }}
                        >
                          {formatCurrency(order.order.taxAmount, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} style={{ padding: 0 }}>
                          <div style={{ borderTop: '1px solid #cbd5e1', margin: '3px 0' }} />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '1px 2px', fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                          Total
                        </td>
                        <td
                          style={{
                            padding: '1px 2px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 800,
                            fontSize: 14,
                            color: '#0f172a',
                          }}
                        >
                          {formatCurrency(order.order.totalAmount, currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {isInternal ? (
        <div
          data-order-internal-only
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: 8,
            fontSize: 10,
            color: '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div>
            Generado por <span style={{ color: '#475569', fontWeight: 600 }}>Rayego POS Botica &amp; Farmacia</span>
          </div>
          <div>Documento interno · {order.order.code}</div>
        </div>
      ) : null}
    </div>
  )
}
