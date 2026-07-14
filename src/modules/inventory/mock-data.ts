export type InventoryLotStatus =
  | 'DISPONIBLE'
  | 'POR_VENCER'
  | 'BLOQUEADO'
  | 'AGOTADO'

export type InventoryMovementType =
  | 'INGRESO'
  | 'SALIDA'
  | 'AJUSTE'
  | 'TRANSFERENCIA'

export type InventoryLotRecord = {
  id: string
  sku: string
  productName: string
  branchName: string
  lotCode: string
  availableUnits: number
  reservedUnits: number
  expiryDate: string
  receivedAt: string
  supplierName: string
  fifoPriority: number
  storageCondition: 'AMBIENTE' | 'REFRIGERADO'
  status: InventoryLotStatus
}

export type InventoryMovementRecord = {
  id: string
  createdAt: string
  type: InventoryMovementType
  productName: string
  lotCode: string
  quantity: number
  reference: string
  actorName: string
  branchName: string
}

export type BranchInventorySummary = {
  branchName: string
  skuCount: number
  lotCount: number
  availableUnits: number
  expiringSoonCount: number
}

export const inventoryLots: InventoryLotRecord[] = [
  {
    id: 'lot-001',
    sku: 'MED-PAR-500-100',
    productName: 'Paracetamol 500 mg',
    branchName: 'Sucursal Principal',
    lotCode: 'PAR-2604-A',
    availableUnits: 78,
    reservedUnits: 6,
    expiryDate: '2026-10-12',
    receivedAt: '2026-04-18',
    supplierName: 'Drogueria Central',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'DISPONIBLE',
  },
  {
    id: 'lot-002',
    sku: 'MED-PAR-500-100',
    productName: 'Paracetamol 500 mg',
    branchName: 'Sucursal Centro',
    lotCode: 'PAR-2605-B',
    availableUnits: 102,
    reservedUnits: 6,
    expiryDate: '2026-12-05',
    receivedAt: '2026-05-09',
    supplierName: 'Drogueria Central',
    fifoPriority: 2,
    storageCondition: 'AMBIENTE',
    status: 'DISPONIBLE',
  },
  {
    id: 'lot-003',
    sku: 'ACF-AMO-500-12',
    productName: 'Amoxicilina 500 mg',
    branchName: 'Sucursal Principal',
    lotCode: 'AMO-2602-C',
    availableUnits: 22,
    reservedUnits: 8,
    expiryDate: '2026-08-25',
    receivedAt: '2026-02-11',
    supplierName: 'AC Farma Distribucion',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'POR_VENCER',
  },
  {
    id: 'lot-004',
    sku: 'BAY-LOR-60-1',
    productName: 'Loratadina Jarabe',
    branchName: 'Sucursal Principal',
    lotCode: 'LOR-2601-A',
    availableUnits: 12,
    reservedUnits: 2,
    expiryDate: '2026-07-30',
    receivedAt: '2026-01-14',
    supplierName: 'Bayer Peru',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'POR_VENCER',
  },
  {
    id: 'lot-005',
    sku: 'BAG-OME-20-14',
    productName: 'Omeprazol 20 mg',
    branchName: 'Sucursal Principal',
    lotCode: 'OME-2606-D',
    availableUnits: 44,
    reservedUnits: 3,
    expiryDate: '2027-01-18',
    receivedAt: '2026-06-22',
    supplierName: 'Bago Comercial',
    fifoPriority: 2,
    storageCondition: 'AMBIENTE',
    status: 'DISPONIBLE',
  },
  {
    id: 'lot-006',
    sku: 'BAG-OME-20-14',
    productName: 'Omeprazol 20 mg',
    branchName: 'Sucursal Centro',
    lotCode: 'OME-2603-B',
    availableUnits: 50,
    reservedUnits: 3,
    expiryDate: '2026-11-03',
    receivedAt: '2026-03-19',
    supplierName: 'Bago Comercial',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'DISPONIBLE',
  },
  {
    id: 'lot-007',
    sku: 'MK-IBU-400-20',
    productName: 'Ibuprofeno 400 mg',
    branchName: 'Sucursal Principal',
    lotCode: 'IBU-2604-X',
    availableUnits: 11,
    reservedUnits: 3,
    expiryDate: '2026-09-14',
    receivedAt: '2026-04-03',
    supplierName: 'MK Supply',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'POR_VENCER',
  },
  {
    id: 'lot-008',
    sku: 'MED-INS-100-1',
    productName: 'Insulina NPH 100 UI',
    branchName: 'Sucursal Principal',
    lotCode: 'INS-2605-R',
    availableUnits: 18,
    reservedUnits: 4,
    expiryDate: '2026-11-26',
    receivedAt: '2026-05-13',
    supplierName: 'Cadena Fria Peru',
    fifoPriority: 1,
    storageCondition: 'REFRIGERADO',
    status: 'DISPONIBLE',
  },
  {
    id: 'lot-009',
    sku: 'MED-CFX-500-7',
    productName: 'Cefalexina 500 mg',
    branchName: 'Sucursal Principal',
    lotCode: 'CFX-2511-Z',
    availableUnits: 0,
    reservedUnits: 0,
    expiryDate: '2026-06-10',
    receivedAt: '2025-11-08',
    supplierName: 'Medifarma',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'AGOTADO',
  },
  {
    id: 'lot-010',
    sku: 'MED-DXZ-4-10',
    productName: 'Dexametasona 4 mg',
    branchName: 'Sucursal Centro',
    lotCode: 'DXZ-2602-Q',
    availableUnits: 15,
    reservedUnits: 0,
    expiryDate: '2026-08-04',
    receivedAt: '2026-02-25',
    supplierName: 'Drogueria Central',
    fifoPriority: 1,
    storageCondition: 'AMBIENTE',
    status: 'BLOQUEADO',
  },
]

export const inventoryMovements: InventoryMovementRecord[] = [
  {
    id: 'mov-001',
    createdAt: '2026-07-13 18:42',
    type: 'SALIDA',
    productName: 'Paracetamol 500 mg',
    lotCode: 'PAR-2604-A',
    quantity: 12,
    reference: 'Venta VNT-000182',
    actorName: 'Operador de Caja',
    branchName: 'Sucursal Principal',
  },
  {
    id: 'mov-002',
    createdAt: '2026-07-13 17:28',
    type: 'INGRESO',
    productName: 'Insulina NPH 100 UI',
    lotCode: 'INS-2605-R',
    quantity: 18,
    reference: 'Compra CMP-000031',
    actorName: 'Supervisor de Operaciones',
    branchName: 'Sucursal Principal',
  },
  {
    id: 'mov-003',
    createdAt: '2026-07-13 16:52',
    type: 'AJUSTE',
    productName: 'Loratadina Jarabe',
    lotCode: 'LOR-2601-A',
    quantity: -2,
    reference: 'Ajuste AJU-000004',
    actorName: 'Administrador General',
    branchName: 'Sucursal Principal',
  },
  {
    id: 'mov-004',
    createdAt: '2026-07-13 15:36',
    type: 'TRANSFERENCIA',
    productName: 'Omeprazol 20 mg',
    lotCode: 'OME-2603-B',
    quantity: 20,
    reference: 'Transferencia TRF-000011',
    actorName: 'Supervisor de Operaciones',
    branchName: 'Sucursal Centro',
  },
  {
    id: 'mov-005',
    createdAt: '2026-07-13 14:08',
    type: 'SALIDA',
    productName: 'Amoxicilina 500 mg',
    lotCode: 'AMO-2602-C',
    quantity: 6,
    reference: 'Venta VNT-000176',
    actorName: 'Operador de Caja',
    branchName: 'Sucursal Principal',
  },
]

export const branchInventorySummary: BranchInventorySummary[] = [
  {
    branchName: 'Sucursal Principal',
    skuCount: 6,
    lotCount: 7,
    availableUnits: 185,
    expiringSoonCount: 3,
  },
  {
    branchName: 'Sucursal Centro',
    skuCount: 4,
    lotCount: 3,
    availableUnits: 167,
    expiringSoonCount: 1,
  },
]
