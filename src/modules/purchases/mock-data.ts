export type PurchaseOrderStatus =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'RECIBIDA_PARCIAL'
  | 'CERRADA'
  | 'ANULADA'

export type PurchaseReceiptStatus =
  | 'PROGRAMADA'
  | 'RECIBIDA'
  | 'OBSERVADA'

export type PurchaseOrderRecord = {
  id: string
  code: string
  supplierName: string
  branchName: string
  buyerName: string
  createdAt: string
  expectedAt: string
  itemCount: number
  totalAmount: number
  status: PurchaseOrderStatus
}

export type PurchaseReceiptRecord = {
  id: string
  purchaseCode: string
  productName: string
  supplierName: string
  receivedAt: string
  lotCode: string
  receivedUnits: number
  expiryDate: string
  branchName: string
  coldChain: boolean
  status: PurchaseReceiptStatus
}

export type SupplierSummaryRecord = {
  supplierName: string
  country: string
  activeOrders: number
  avgLeadTimeDays: number
  serviceLevel: number
  criticalProducts: number
}

export const purchaseOrders: PurchaseOrderRecord[] = [
  {
    id: 'cmp-001',
    code: 'CMP-000031',
    supplierName: 'Cadena Fria Peru',
    branchName: 'Sucursal Principal',
    buyerName: 'Supervisor de Operaciones',
    createdAt: '2026-07-10',
    expectedAt: '2026-07-13',
    itemCount: 4,
    totalAmount: 1860.4,
    status: 'RECIBIDA_PARCIAL',
  },
  {
    id: 'cmp-002',
    code: 'CMP-000032',
    supplierName: 'Drogueria Central',
    branchName: 'Sucursal Principal',
    buyerName: 'Administrador General',
    createdAt: '2026-07-11',
    expectedAt: '2026-07-15',
    itemCount: 7,
    totalAmount: 2435.9,
    status: 'EMITIDA',
  },
  {
    id: 'cmp-003',
    code: 'CMP-000033',
    supplierName: 'Bago Comercial',
    branchName: 'Sucursal Centro',
    buyerName: 'Supervisor de Operaciones',
    createdAt: '2026-07-09',
    expectedAt: '2026-07-12',
    itemCount: 3,
    totalAmount: 984.2,
    status: 'CERRADA',
  },
  {
    id: 'cmp-004',
    code: 'CMP-000034',
    supplierName: 'AC Farma Distribucion',
    branchName: 'Sucursal Principal',
    buyerName: 'Supervisor de Operaciones',
    createdAt: '2026-07-13',
    expectedAt: '2026-07-17',
    itemCount: 2,
    totalAmount: 642.8,
    status: 'BORRADOR',
  },
  {
    id: 'cmp-005',
    code: 'CMP-000028',
    supplierName: 'Bayer Peru',
    branchName: 'Sucursal Principal',
    buyerName: 'Administrador General',
    createdAt: '2026-07-05',
    expectedAt: '2026-07-08',
    itemCount: 2,
    totalAmount: 488.6,
    status: 'ANULADA',
  },
]

export const purchaseReceipts: PurchaseReceiptRecord[] = [
  {
    id: 'rcp-001',
    purchaseCode: 'CMP-000031',
    productName: 'Insulina NPH 100 UI',
    supplierName: 'Cadena Fria Peru',
    receivedAt: '2026-07-13 17:28',
    lotCode: 'INS-2605-R',
    receivedUnits: 18,
    expiryDate: '2026-11-26',
    branchName: 'Sucursal Principal',
    coldChain: true,
    status: 'RECIBIDA',
  },
  {
    id: 'rcp-002',
    purchaseCode: 'CMP-000032',
    productName: 'Paracetamol 500 mg',
    supplierName: 'Drogueria Central',
    receivedAt: '2026-07-15 09:00',
    lotCode: 'PAR-2607-C',
    receivedUnits: 120,
    expiryDate: '2027-01-15',
    branchName: 'Sucursal Principal',
    coldChain: false,
    status: 'PROGRAMADA',
  },
  {
    id: 'rcp-003',
    purchaseCode: 'CMP-000033',
    productName: 'Omeprazol 20 mg',
    supplierName: 'Bago Comercial',
    receivedAt: '2026-07-12 10:24',
    lotCode: 'OME-2607-E',
    receivedUnits: 36,
    expiryDate: '2027-02-02',
    branchName: 'Sucursal Centro',
    coldChain: false,
    status: 'RECIBIDA',
  },
  {
    id: 'rcp-004',
    purchaseCode: 'CMP-000032',
    productName: 'Amoxicilina 500 mg',
    supplierName: 'Drogueria Central',
    receivedAt: '2026-07-15 09:00',
    lotCode: 'AMO-2607-D',
    receivedUnits: 48,
    expiryDate: '2026-12-18',
    branchName: 'Sucursal Principal',
    coldChain: false,
    status: 'PROGRAMADA',
  },
  {
    id: 'rcp-005',
    purchaseCode: 'CMP-000031',
    productName: 'Vacuna Influenza',
    supplierName: 'Cadena Fria Peru',
    receivedAt: '2026-07-13 17:30',
    lotCode: 'VAC-2606-X',
    receivedUnits: 20,
    expiryDate: '2026-09-10',
    branchName: 'Sucursal Principal',
    coldChain: true,
    status: 'OBSERVADA',
  },
]

export const supplierSummary: SupplierSummaryRecord[] = [
  {
    supplierName: 'Drogueria Central',
    country: 'Peru',
    activeOrders: 1,
    avgLeadTimeDays: 4,
    serviceLevel: 96,
    criticalProducts: 3,
  },
  {
    supplierName: 'Cadena Fria Peru',
    country: 'Peru',
    activeOrders: 1,
    avgLeadTimeDays: 3,
    serviceLevel: 92,
    criticalProducts: 2,
  },
  {
    supplierName: 'Bago Comercial',
    country: 'Argentina',
    activeOrders: 0,
    avgLeadTimeDays: 5,
    serviceLevel: 98,
    criticalProducts: 1,
  },
  {
    supplierName: 'AC Farma Distribucion',
    country: 'Peru',
    activeOrders: 1,
    avgLeadTimeDays: 4,
    serviceLevel: 94,
    criticalProducts: 2,
  },
]
