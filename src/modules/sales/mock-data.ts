export type SaleStatus = 'EMITIDA' | 'PENDIENTE_PAGO' | 'ANULADA'

export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN'

export type SalesCartItem = {
  id: string
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  suggestedLotCode: string
  expiresAt: string
  requiresPrescription: boolean
}

export type RecentSaleRecord = {
  id: string
  code: string
  customerName: string
  cashierName: string
  createdAt: string
  totalAmount: number
  paymentMethods: PaymentMethod[]
  itemCount: number
  status: SaleStatus
}

export type PrescriptionControlRecord = {
  id: string
  productName: string
  customerName: string
  doctorName: string
  prescriptionCode: string
  dispensedAt: string
  lotCode: string
  status: 'VALIDADA' | 'PENDIENTE'
}

export const salesCartItems: SalesCartItem[] = [
  {
    id: 'crt-001',
    sku: 'MED-PAR-500-100',
    productName: 'Paracetamol 500 mg',
    quantity: 2,
    unitPrice: 8.9,
    discount: 0,
    suggestedLotCode: 'PAR-2604-A',
    expiresAt: '2026-10-12',
    requiresPrescription: false,
  },
  {
    id: 'crt-002',
    sku: 'ACF-AMO-500-12',
    productName: 'Amoxicilina 500 mg',
    quantity: 1,
    unitPrice: 18.5,
    discount: 1.5,
    suggestedLotCode: 'AMO-2602-C',
    expiresAt: '2026-08-25',
    requiresPrescription: true,
  },
  {
    id: 'crt-003',
    sku: 'BAG-OME-20-14',
    productName: 'Omeprazol 20 mg',
    quantity: 1,
    unitPrice: 22.4,
    discount: 0,
    suggestedLotCode: 'OME-2603-B',
    expiresAt: '2026-11-03',
    requiresPrescription: false,
  },
]

export const recentSales: RecentSaleRecord[] = [
  {
    id: 'vnt-001',
    code: 'VNT-000182',
    customerName: 'Juan Perez',
    cashierName: 'Operador de Caja',
    createdAt: '2026-07-13 18:42',
    totalAmount: 44.8,
    paymentMethods: ['EFECTIVO'],
    itemCount: 3,
    status: 'EMITIDA',
  },
  {
    id: 'vnt-002',
    code: 'VNT-000181',
    customerName: 'Maria Salazar',
    cashierName: 'Operador de Caja',
    createdAt: '2026-07-13 18:11',
    totalAmount: 31.7,
    paymentMethods: ['YAPE'],
    itemCount: 2,
    status: 'EMITIDA',
  },
  {
    id: 'vnt-003',
    code: 'VNT-000180',
    customerName: 'Carlos Rojas',
    cashierName: 'Operador de Caja',
    createdAt: '2026-07-13 17:54',
    totalAmount: 87.2,
    paymentMethods: ['TARJETA', 'EFECTIVO'],
    itemCount: 4,
    status: 'EMITIDA',
  },
  {
    id: 'vnt-004',
    code: 'VNT-000179',
    customerName: 'Venta mostrador',
    cashierName: 'Operador de Caja',
    createdAt: '2026-07-13 17:16',
    totalAmount: 16.9,
    paymentMethods: ['PLIN'],
    itemCount: 1,
    status: 'PENDIENTE_PAGO',
  },
]

export const prescriptionControls: PrescriptionControlRecord[] = [
  {
    id: 'prc-001',
    productName: 'Amoxicilina 500 mg',
    customerName: 'Juan Perez',
    doctorName: 'Dra. Vilchez',
    prescriptionCode: 'RX-000981',
    dispensedAt: '2026-07-13 18:40',
    lotCode: 'AMO-2602-C',
    status: 'VALIDADA',
  },
  {
    id: 'prc-002',
    productName: 'Cefalexina 500 mg',
    customerName: 'Ana Torres',
    doctorName: 'Dr. Mendoza',
    prescriptionCode: 'RX-000977',
    dispensedAt: '2026-07-13 17:08',
    lotCode: 'CFX-2511-Z',
    status: 'PENDIENTE',
  },
]
