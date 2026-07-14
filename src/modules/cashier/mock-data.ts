import type { PaymentMethod } from '@/modules/sales/mock-data'

export type CashDrawerStatus = 'ABIERTA' | 'EN_CIERRE' | 'CERRADA'

export type CashMovementType =
  | 'VENTA'
  | 'INGRESO_MANUAL'
  | 'EGRESO'
  | 'RETIRO'
  | 'CUADRE'

export type CashDrawerRecord = {
  id: string
  code: string
  branchName: string
  cashierName: string
  openedAt: string
  openingAmount: number
  expectedAmount: number
  countedAmount: number
  differenceAmount: number
  status: CashDrawerStatus
}

export type CashMovementRecord = {
  id: string
  createdAt: string
  type: CashMovementType
  description: string
  reference: string
  paymentMethod: PaymentMethod | 'INTERNO'
  amount: number
  actorName: string
}

export type CashPaymentSummaryRecord = {
  method: PaymentMethod
  salesAmount: number
  collectedAmount: number
  operations: number
}

export const cashDrawers: CashDrawerRecord[] = [
  {
    id: 'caj-001',
    code: 'CJ-2026-07-13-A',
    branchName: 'Sucursal Principal',
    cashierName: 'Operador de Caja',
    openedAt: '2026-07-13 08:00',
    openingAmount: 300,
    expectedAmount: 780.7,
    countedAmount: 778.7,
    differenceAmount: -2,
    status: 'EN_CIERRE',
  },
  {
    id: 'caj-002',
    code: 'CJ-2026-07-13-B',
    branchName: 'Sucursal Centro',
    cashierName: 'Operador Turno Tarde',
    openedAt: '2026-07-13 09:00',
    openingAmount: 250,
    expectedAmount: 612.4,
    countedAmount: 612.4,
    differenceAmount: 0,
    status: 'ABIERTA',
  },
  {
    id: 'caj-003',
    code: 'CJ-2026-07-12-A',
    branchName: 'Sucursal Principal',
    cashierName: 'Operador de Caja',
    openedAt: '2026-07-12 08:02',
    openingAmount: 300,
    expectedAmount: 845.1,
    countedAmount: 845.1,
    differenceAmount: 0,
    status: 'CERRADA',
  },
]

export const cashMovements: CashMovementRecord[] = [
  {
    id: 'mov-caj-001',
    createdAt: '2026-07-13 18:42',
    type: 'VENTA',
    description: 'Cobro de venta mostrador',
    reference: 'VNT-000182',
    paymentMethod: 'EFECTIVO',
    amount: 44.8,
    actorName: 'Operador de Caja',
  },
  {
    id: 'mov-caj-002',
    createdAt: '2026-07-13 18:11',
    type: 'VENTA',
    description: 'Cobro con billetera digital',
    reference: 'VNT-000181',
    paymentMethod: 'YAPE',
    amount: 31.7,
    actorName: 'Operador de Caja',
  },
  {
    id: 'mov-caj-003',
    createdAt: '2026-07-13 17:54',
    type: 'VENTA',
    description: 'Cobro mixto con tarjeta y efectivo',
    reference: 'VNT-000180',
    paymentMethod: 'TARJETA',
    amount: 60,
    actorName: 'Operador de Caja',
  },
  {
    id: 'mov-caj-004',
    createdAt: '2026-07-13 17:55',
    type: 'VENTA',
    description: 'Cobro mixto complementario',
    reference: 'VNT-000180',
    paymentMethod: 'EFECTIVO',
    amount: 27.2,
    actorName: 'Operador de Caja',
  },
  {
    id: 'mov-caj-005',
    createdAt: '2026-07-13 15:10',
    type: 'EGRESO',
    description: 'Compra menor de insumos operativos',
    reference: 'EGR-000021',
    paymentMethod: 'INTERNO',
    amount: -18,
    actorName: 'Operador de Caja',
  },
  {
    id: 'mov-caj-006',
    createdAt: '2026-07-13 13:05',
    type: 'INGRESO_MANUAL',
    description: 'Ingreso por recarga de fondo de sencillo',
    reference: 'ING-000014',
    paymentMethod: 'INTERNO',
    amount: 50,
    actorName: 'Supervisor de Operaciones',
  },
  {
    id: 'mov-caj-007',
    createdAt: '2026-07-13 19:02',
    type: 'CUADRE',
    description: 'Conteo preliminar de cierre',
    reference: 'CIE-000008',
    paymentMethod: 'INTERNO',
    amount: 778.7,
    actorName: 'Operador de Caja',
  },
]

export const cashPaymentSummary: CashPaymentSummaryRecord[] = [
  {
    method: 'EFECTIVO',
    salesAmount: 72,
    collectedAmount: 70,
    operations: 2,
  },
  {
    method: 'TARJETA',
    salesAmount: 60,
    collectedAmount: 60,
    operations: 1,
  },
  {
    method: 'YAPE',
    salesAmount: 31.7,
    collectedAmount: 31.7,
    operations: 1,
  },
  {
    method: 'PLIN',
    salesAmount: 16.9,
    collectedAmount: 0,
    operations: 1,
  },
]
