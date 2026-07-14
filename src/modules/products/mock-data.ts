export type ProductStatus = 'ACTIVO' | 'BAJO_REVISION' | 'DESCONTINUADO'

export type ProductRecord = {
  id: string
  sku: string
  name: string
  genericName: string
  category: string
  laboratory: string
  presentation: string
  concentration: string
  salePrice: number
  costPrice: number
  stockUnits: number
  reservedUnits: number
  lotCount: number
  nextExpiry: string
  branchCoverage: number
  requiresPrescription: boolean
  isControlled: boolean
  coldChain: boolean
  status: ProductStatus
}

export const productCategories = [
  { name: 'Analgesicos', skuCount: 14, activeCount: 12 },
  { name: 'Antibioticos', skuCount: 11, activeCount: 9 },
  { name: 'Vitaminas', skuCount: 8, activeCount: 8 },
  { name: 'Respiratorios', skuCount: 10, activeCount: 7 },
  { name: 'Cuidado digestivo', skuCount: 6, activeCount: 5 },
]

export const laboratories = [
  { name: 'AC Farma', country: 'Peru', skuCount: 12 },
  { name: 'Medifarma', country: 'Peru', skuCount: 10 },
  { name: 'Bago', country: 'Argentina', skuCount: 7 },
  { name: 'Bayer', country: 'Alemania', skuCount: 6 },
  { name: 'MK', country: 'Colombia', skuCount: 8 },
]

export const activePrinciples = [
  { name: 'Paracetamol', form: 'Tableta', productCount: 5 },
  { name: 'Amoxicilina', form: 'Capsula', productCount: 4 },
  { name: 'Ibuprofeno', form: 'Tableta', productCount: 4 },
  { name: 'Loratadina', form: 'Jarabe', productCount: 3 },
  { name: 'Omeprazol', form: 'Capsula', productCount: 3 },
]

export const productRecords: ProductRecord[] = [
  {
    id: 'prd-001',
    sku: 'MED-PAR-500-100',
    name: 'Paracetamol 500 mg',
    genericName: 'Acetaminofen',
    category: 'Analgesicos',
    laboratory: 'Medifarma',
    presentation: 'Caja x 100 tabletas',
    concentration: '500 mg',
    salePrice: 8.9,
    costPrice: 5.1,
    stockUnits: 180,
    reservedUnits: 12,
    lotCount: 3,
    nextExpiry: '2026-10-12',
    branchCoverage: 2,
    requiresPrescription: false,
    isControlled: false,
    coldChain: false,
    status: 'ACTIVO',
  },
  {
    id: 'prd-002',
    sku: 'ACF-AMO-500-12',
    name: 'Amoxicilina 500 mg',
    genericName: 'Amoxicilina',
    category: 'Antibioticos',
    laboratory: 'AC Farma',
    presentation: 'Caja x 12 capsulas',
    concentration: '500 mg',
    salePrice: 18.5,
    costPrice: 11.2,
    stockUnits: 42,
    reservedUnits: 8,
    lotCount: 2,
    nextExpiry: '2026-08-25',
    branchCoverage: 1,
    requiresPrescription: true,
    isControlled: false,
    coldChain: false,
    status: 'ACTIVO',
  },
  {
    id: 'prd-003',
    sku: 'BAY-LOR-60-1',
    name: 'Loratadina Jarabe',
    genericName: 'Loratadina',
    category: 'Respiratorios',
    laboratory: 'Bayer',
    presentation: 'Frasco 60 ml',
    concentration: '5 mg / 5 ml',
    salePrice: 16.9,
    costPrice: 10.4,
    stockUnits: 26,
    reservedUnits: 2,
    lotCount: 1,
    nextExpiry: '2026-07-30',
    branchCoverage: 2,
    requiresPrescription: false,
    isControlled: false,
    coldChain: false,
    status: 'BAJO_REVISION',
  },
  {
    id: 'prd-004',
    sku: 'BAG-OME-20-14',
    name: 'Omeprazol 20 mg',
    genericName: 'Omeprazol',
    category: 'Cuidado digestivo',
    laboratory: 'Bago',
    presentation: 'Caja x 14 capsulas',
    concentration: '20 mg',
    salePrice: 22.4,
    costPrice: 14.9,
    stockUnits: 94,
    reservedUnits: 6,
    lotCount: 4,
    nextExpiry: '2027-01-18',
    branchCoverage: 2,
    requiresPrescription: false,
    isControlled: false,
    coldChain: false,
    status: 'ACTIVO',
  },
  {
    id: 'prd-005',
    sku: 'MK-IBU-400-20',
    name: 'Ibuprofeno 400 mg',
    genericName: 'Ibuprofeno',
    category: 'Analgesicos',
    laboratory: 'MK',
    presentation: 'Caja x 20 tabletas',
    concentration: '400 mg',
    salePrice: 12.8,
    costPrice: 7.6,
    stockUnits: 14,
    reservedUnits: 3,
    lotCount: 1,
    nextExpiry: '2026-09-14',
    branchCoverage: 1,
    requiresPrescription: false,
    isControlled: false,
    coldChain: false,
    status: 'BAJO_REVISION',
  },
  {
    id: 'prd-006',
    sku: 'MED-CFX-500-7',
    name: 'Cefalexina 500 mg',
    genericName: 'Cefalexina',
    category: 'Antibioticos',
    laboratory: 'Medifarma',
    presentation: 'Caja x 7 capsulas',
    concentration: '500 mg',
    salePrice: 24.7,
    costPrice: 16.8,
    stockUnits: 0,
    reservedUnits: 0,
    lotCount: 0,
    nextExpiry: 'Sin lotes',
    branchCoverage: 0,
    requiresPrescription: true,
    isControlled: false,
    coldChain: false,
    status: 'DESCONTINUADO',
  },
]
