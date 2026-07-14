export type SupplierStatus = 'ACTIVO' | 'OBSERVADO' | 'INACTIVO'

export type SupplierCategory =
  | 'DROGUERIA'
  | 'LABORATORIO'
  | 'CADENA_FRIO'
  | 'DISTRIBUIDOR'

export type SupplierRecord = {
  id: string
  businessName: string
  category: SupplierCategory
  country: string
  taxId: string
  contactName: string
  phone: string
  email: string
  leadTimeDays: number
  serviceLevel: number
  activeProducts: number
  status: SupplierStatus
}

export type SupplierDocumentRecord = {
  id: string
  supplierName: string
  documentType: 'CONTRATO' | 'REGISTRO_SANITARIO' | 'CERTIFICADO' | 'LISTA_PRECIOS'
  reference: string
  expiresAt: string
  status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO'
}

export type SupplierAlertRecord = {
  id: string
  supplierName: string
  title: string
  note: string
  priority: 'ALTA' | 'MEDIA' | 'BAJA'
}

export const supplierRecords: SupplierRecord[] = [
  {
    id: 'sup-001',
    businessName: 'Drogueria Central',
    category: 'DROGUERIA',
    country: 'Peru',
    taxId: '20477896541',
    contactName: 'Lucia Mendoza',
    phone: '944210301',
    email: 'compras@drogueriacentral.pe',
    leadTimeDays: 4,
    serviceLevel: 96,
    activeProducts: 42,
    status: 'ACTIVO',
  },
  {
    id: 'sup-002',
    businessName: 'Cadena Fria Peru',
    category: 'CADENA_FRIO',
    country: 'Peru',
    taxId: '20511478302',
    contactName: 'Rafael Paredes',
    phone: '981224508',
    email: 'operaciones@cadenafrioperu.pe',
    leadTimeDays: 3,
    serviceLevel: 92,
    activeProducts: 12,
    status: 'ACTIVO',
  },
  {
    id: 'sup-003',
    businessName: 'Bago Comercial',
    category: 'LABORATORIO',
    country: 'Argentina',
    taxId: '30988412567',
    contactName: 'Natalia Ruiz',
    phone: '51981776432',
    email: 'distribucion@bagocomercial.com',
    leadTimeDays: 5,
    serviceLevel: 98,
    activeProducts: 18,
    status: 'ACTIVO',
  },
  {
    id: 'sup-004',
    businessName: 'AC Farma Distribucion',
    category: 'DISTRIBUIDOR',
    country: 'Peru',
    taxId: '20498211364',
    contactName: 'Edgar Quispe',
    phone: '987440225',
    email: 'ventas@acfarma.pe',
    leadTimeDays: 4,
    serviceLevel: 94,
    activeProducts: 21,
    status: 'ACTIVO',
  },
  {
    id: 'sup-005',
    businessName: 'Bayer Peru',
    category: 'LABORATORIO',
    country: 'Alemania',
    taxId: '20533477812',
    contactName: 'Paola Velez',
    phone: '976551184',
    email: 'canalboticas@bayer.pe',
    leadTimeDays: 6,
    serviceLevel: 88,
    activeProducts: 9,
    status: 'OBSERVADO',
  },
]

export const supplierDocuments: SupplierDocumentRecord[] = [
  {
    id: 'sdoc-001',
    supplierName: 'Drogueria Central',
    documentType: 'LISTA_PRECIOS',
    reference: 'LP-2026-Q3',
    expiresAt: '2026-09-30',
    status: 'VIGENTE',
  },
  {
    id: 'sdoc-002',
    supplierName: 'Cadena Fria Peru',
    documentType: 'CERTIFICADO',
    reference: 'CF-ISO-4421',
    expiresAt: '2026-08-12',
    status: 'POR_VENCER',
  },
  {
    id: 'sdoc-003',
    supplierName: 'Bayer Peru',
    documentType: 'REGISTRO_SANITARIO',
    reference: 'RS-BAY-771',
    expiresAt: '2026-07-20',
    status: 'POR_VENCER',
  },
  {
    id: 'sdoc-004',
    supplierName: 'AC Farma Distribucion',
    documentType: 'CONTRATO',
    reference: 'CTR-ACF-2026',
    expiresAt: '2027-01-10',
    status: 'VIGENTE',
  },
]

export const supplierAlerts: SupplierAlertRecord[] = [
  {
    id: 'salt-001',
    supplierName: 'Bayer Peru',
    title: 'Caida en nivel de servicio',
    note: 'El proveedor descendio a 88% y requiere seguimiento en proximas ordenes.',
    priority: 'ALTA',
  },
  {
    id: 'salt-002',
    supplierName: 'Cadena Fria Peru',
    title: 'Certificado por renovar',
    note: 'El certificado operativo vence pronto y debe validarse antes de nuevas compras.',
    priority: 'MEDIA',
  },
  {
    id: 'salt-003',
    supplierName: 'Drogueria Central',
    title: 'Actualizar lista de precios',
    note: 'Revisar condiciones comerciales del siguiente trimestre.',
    priority: 'BAJA',
  },
]
