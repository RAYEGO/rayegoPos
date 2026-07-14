export type CustomerStatus = 'ACTIVO' | 'OBSERVADO' | 'INACTIVO'

export type CustomerSegment = 'FRECUENTE' | 'CORPORATIVO' | 'OCASIONAL'

export type CustomerRecord = {
  id: string
  fullName: string
  documentType: 'DNI' | 'RUC' | 'CE'
  documentNumber: string
  phone: string
  district: string
  lastPurchaseAt: string
  totalSpent: number
  visitCount: number
  segment: CustomerSegment
  status: CustomerStatus
}

export type CustomerPurchaseRecord = {
  id: string
  customerName: string
  saleCode: string
  createdAt: string
  itemSummary: string
  totalAmount: number
  paymentMethod: 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN'
}

export type CustomerFollowUpRecord = {
  id: string
  customerName: string
  productName: string
  note: string
  dueAt: string
  priority: 'ALTA' | 'MEDIA' | 'BAJA'
}

export const customerRecords: CustomerRecord[] = [
  {
    id: 'cli-001',
    fullName: 'Juan Perez',
    documentType: 'DNI',
    documentNumber: '45871236',
    phone: '987654321',
    district: 'Trujillo Centro',
    lastPurchaseAt: '2026-07-13 18:42',
    totalSpent: 412.6,
    visitCount: 14,
    segment: 'FRECUENTE',
    status: 'ACTIVO',
  },
  {
    id: 'cli-002',
    fullName: 'Maria Salazar',
    documentType: 'DNI',
    documentNumber: '72184539',
    phone: '945221137',
    district: 'La Esperanza',
    lastPurchaseAt: '2026-07-13 18:11',
    totalSpent: 186.4,
    visitCount: 7,
    segment: 'FRECUENTE',
    status: 'ACTIVO',
  },
  {
    id: 'cli-003',
    fullName: 'Carlos Rojas',
    documentType: 'DNI',
    documentNumber: '46791258',
    phone: '962885441',
    district: 'Victor Larco',
    lastPurchaseAt: '2026-07-13 17:54',
    totalSpent: 690.2,
    visitCount: 10,
    segment: 'CORPORATIVO',
    status: 'ACTIVO',
  },
  {
    id: 'cli-004',
    fullName: 'Ana Torres',
    documentType: 'CE',
    documentNumber: 'X0029183',
    phone: '981332214',
    district: 'Moche',
    lastPurchaseAt: '2026-07-12 16:08',
    totalSpent: 128.9,
    visitCount: 3,
    segment: 'OCASIONAL',
    status: 'OBSERVADO',
  },
  {
    id: 'cli-005',
    fullName: 'Empresa Salud Norte SAC',
    documentType: 'RUC',
    documentNumber: '20481236511',
    phone: '944200511',
    district: 'Trujillo Centro',
    lastPurchaseAt: '2026-07-10 11:25',
    totalSpent: 1840.4,
    visitCount: 6,
    segment: 'CORPORATIVO',
    status: 'ACTIVO',
  },
]

export const customerPurchases: CustomerPurchaseRecord[] = [
  {
    id: 'cp-001',
    customerName: 'Juan Perez',
    saleCode: 'VNT-000182',
    createdAt: '2026-07-13 18:42',
    itemSummary: 'Paracetamol, Amoxicilina, Omeprazol',
    totalAmount: 44.8,
    paymentMethod: 'EFECTIVO',
  },
  {
    id: 'cp-002',
    customerName: 'Maria Salazar',
    saleCode: 'VNT-000181',
    createdAt: '2026-07-13 18:11',
    itemSummary: 'Loratadina, Ibuprofeno',
    totalAmount: 31.7,
    paymentMethod: 'YAPE',
  },
  {
    id: 'cp-003',
    customerName: 'Carlos Rojas',
    saleCode: 'VNT-000180',
    createdAt: '2026-07-13 17:54',
    itemSummary: 'Vitaminas, Omeprazol, Paracetamol',
    totalAmount: 87.2,
    paymentMethod: 'TARJETA',
  },
  {
    id: 'cp-004',
    customerName: 'Ana Torres',
    saleCode: 'VNT-000171',
    createdAt: '2026-07-12 16:08',
    itemSummary: 'Cefalexina 500 mg',
    totalAmount: 24.7,
    paymentMethod: 'EFECTIVO',
  },
]

export const customerFollowUps: CustomerFollowUpRecord[] = [
  {
    id: 'cf-001',
    customerName: 'Juan Perez',
    productName: 'Amoxicilina 500 mg',
    note: 'Confirmar continuidad del tratamiento y siguiente compra.',
    dueAt: '2026-07-15',
    priority: 'MEDIA',
  },
  {
    id: 'cf-002',
    customerName: 'Ana Torres',
    productName: 'Cefalexina 500 mg',
    note: 'Regularizar validacion de receta pendiente.',
    dueAt: '2026-07-14',
    priority: 'ALTA',
  },
  {
    id: 'cf-003',
    customerName: 'Empresa Salud Norte SAC',
    productName: 'Botiquin institucional',
    note: 'Revisar recompra programada para fin de mes.',
    dueAt: '2026-07-25',
    priority: 'BAJA',
  },
]
