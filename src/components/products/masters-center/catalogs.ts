import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  Barcode,
  Beaker,
  Box,
  Boxes,
  Building2,
  FlaskConical,
  Layers,
  Package,
  Tags,
  ThermometerSnowflake,
  Truck,
} from 'lucide-react'

export type MasterCatalogGroup =
  | 'clasificacion'
  | 'farmaceutica'
  | 'inventario'
  | 'configuracion'

export type MasterCatalogKey =
  | 'categorias'
  | 'subcategorias'
  | 'laboratorios'
  | 'marcas'
  | 'principiosActivos'
  | 'formasFarmaceuticas'
  | 'viasAdministracion'
  | 'concentraciones'
  | 'condicionVenta'
  | 'tipoMedicamento'
  | 'presentaciones'
  | 'unidadesMedida'
  | 'tiposEmpaque'
  | 'condicionesConservacion'
  | 'impuestos'
  | 'estadosProducto'
  | 'codigosBarras'

export type MasterRecord = {
  id: string
  code: string
  name: string
  description: string
  active: boolean
  productCount: number
  createdAt: string
}

export type MasterCatalogConfig = {
  key: MasterCatalogKey
  label: string
  group: MasterCatalogGroup
  icon: LucideIcon
  description: string
  searchPlaceholder: string
  codePrefix: string
}

export const masterGroups: Array<{ key: MasterCatalogGroup; label: string }> = [
  { key: 'clasificacion', label: 'Clasificación' },
  { key: 'farmaceutica', label: 'Información Farmacéutica' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'configuracion', label: 'Configuración' },
]

export const masterCatalogs: MasterCatalogConfig[] = [
  {
    key: 'categorias',
    label: 'Categorías',
    group: 'clasificacion',
    icon: Tags,
    description: 'Organiza el catálogo de medicamentos por familias comerciales.',
    searchPlaceholder: 'Buscar categoría...',
    codePrefix: 'CAT',
  },
  {
    key: 'subcategorias',
    label: 'Subcategorías',
    group: 'clasificacion',
    icon: Layers,
    description: 'Segmentación adicional para análisis y reportes más precisos.',
    searchPlaceholder: 'Buscar subcategoría...',
    codePrefix: 'SUB',
  },
  {
    key: 'laboratorios',
    label: 'Laboratorios',
    group: 'clasificacion',
    icon: Building2,
    description: 'Fabricantes o laboratorios asociados a los medicamentos.',
    searchPlaceholder: 'Buscar laboratorio...',
    codePrefix: 'LAB',
  },
  {
    key: 'marcas',
    label: 'Marcas',
    group: 'clasificacion',
    icon: Box,
    description: 'Marcas comerciales utilizadas en el registro de productos.',
    searchPlaceholder: 'Buscar marca...',
    codePrefix: 'MAR',
  },
  {
    key: 'principiosActivos',
    label: 'Principios Activos',
    group: 'farmaceutica',
    icon: Beaker,
    description: 'Sustancias activas para identificación farmacológica.',
    searchPlaceholder: 'Buscar principio activo...',
    codePrefix: 'PA',
  },
  {
    key: 'formasFarmaceuticas',
    label: 'Formas Farmacéuticas',
    group: 'farmaceutica',
    icon: FlaskConical,
    description: 'Tableta, cápsula, jarabe, crema y otras presentaciones farmacéuticas.',
    searchPlaceholder: 'Buscar forma farmacéutica...',
    codePrefix: 'FF',
  },
  {
    key: 'viasAdministracion',
    label: 'Vías de Administración',
    group: 'farmaceutica',
    icon: Truck,
    description: 'Oral, tópica, intramuscular y otras vías de uso.',
    searchPlaceholder: 'Buscar vía...',
    codePrefix: 'VIA',
  },
  {
    key: 'concentraciones',
    label: 'Concentraciones',
    group: 'farmaceutica',
    icon: BadgePercent,
    description: 'Concentraciones típicas para estandarizar registros.',
    searchPlaceholder: 'Buscar concentración...',
    codePrefix: 'CON',
  },
  {
    key: 'condicionVenta',
    label: 'Condición de Venta',
    group: 'farmaceutica',
    icon: Package,
    description: 'Reglas de venta como libre, receta, controlado y otros.',
    searchPlaceholder: 'Buscar condición de venta...',
    codePrefix: 'CV',
  },
  {
    key: 'tipoMedicamento',
    label: 'Tipo de Medicamento',
    group: 'farmaceutica',
    icon: Boxes,
    description: 'Clasificación según el tipo de medicamento para reportes.',
    searchPlaceholder: 'Buscar tipo...',
    codePrefix: 'TM',
  },
  {
    key: 'presentaciones',
    label: 'Presentaciones',
    group: 'inventario',
    icon: Package,
    description: 'Presentaciones comerciales: caja, blister, frasco, etc.',
    searchPlaceholder: 'Buscar presentación...',
    codePrefix: 'PRE',
  },
  {
    key: 'unidadesMedida',
    label: 'Unidades de Medida',
    group: 'inventario',
    icon: Boxes,
    description: 'Unidades: und, ml, g, frasco, etc.',
    searchPlaceholder: 'Buscar unidad...',
    codePrefix: 'UNI',
  },
  {
    key: 'tiposEmpaque',
    label: 'Tipos de Empaque',
    group: 'inventario',
    icon: Box,
    description: 'Empaques para facilitar picking y control de stock.',
    searchPlaceholder: 'Buscar empaque...',
    codePrefix: 'EMP',
  },
  {
    key: 'condicionesConservacion',
    label: 'Condiciones de Conservación',
    group: 'inventario',
    icon: ThermometerSnowflake,
    description: 'Ambiente, refrigerado, cadena de frío y otros.',
    searchPlaceholder: 'Buscar condición de conservación...',
    codePrefix: 'CC',
  },
  {
    key: 'impuestos',
    label: 'Impuestos',
    group: 'configuracion',
    icon: BadgePercent,
    description: 'Impuestos y tasas aplicables a productos.',
    searchPlaceholder: 'Buscar impuesto...',
    codePrefix: 'IMP',
  },
  {
    key: 'estadosProducto',
    label: 'Estados del Producto',
    group: 'configuracion',
    icon: Boxes,
    description: 'Estados operativos: activo, inactivo, descontinuado, etc.',
    searchPlaceholder: 'Buscar estado...',
    codePrefix: 'EST',
  },
  {
    key: 'codigosBarras',
    label: 'Códigos de Barras',
    group: 'configuracion',
    icon: Barcode,
    description: 'Configuraciones y reglas de códigos de barras.',
    searchPlaceholder: 'Buscar código...',
    codePrefix: 'BAR',
  },
]

export type MasterStore = Record<MasterCatalogKey, MasterRecord[]>

function padNumber(value: number) {
  return value.toString().padStart(3, '0')
}

function buildTodayIso() {
  return new Date().toISOString()
}

function createRecord(prefix: string, index: number, overrides: Partial<MasterRecord> = {}): MasterRecord {
  const now = buildTodayIso()
  return {
    id: crypto.randomUUID(),
    code: `${prefix}-${padNumber(index)}`,
    name: `${prefix} ${padNumber(index)}`,
    description: 'Descripción breve para mantener consistencia de catálogo.',
    active: true,
    productCount: Math.floor(Math.random() * 28),
    createdAt: now,
    ...overrides,
  }
}

function buildRecords(prefix: string, count: number, nameSeed?: string[]) {
  return Array.from({ length: count }).map((_, index) => {
    const seed = nameSeed?.[index]
    return createRecord(prefix, index + 1, seed ? { name: seed } : {})
  })
}

export function buildInitialMastersStore(): MasterStore {
  return {
    categorias: buildRecords('CAT', 42, [
      'Analgesia y Antiinflamatorios',
      'Antibióticos',
      'Vitaminas y Suplementos',
      'Dermatología',
      'Gastroenterología',
      'Cardiología',
    ]),
    subcategorias: buildRecords('SUB', 12),
    laboratorios: buildRecords('LAB', 95, [
      'Bayer',
      'Abbott',
      'Pfizer',
      'Roche',
      'Sanofi',
      'Novartis',
    ]),
    marcas: buildRecords('MAR', 38, ['Panadol', 'Aspirina', 'Dolex', 'Bepanthen', 'Redoxon']),
    principiosActivos: buildRecords('PA', 312, [
      'Paracetamol',
      'Ibuprofeno',
      'Amoxicilina',
      'Loratadina',
      'Omeprazol',
      'Metformina',
    ]),
    formasFarmaceuticas: buildRecords('FF', 15, [
      'Tableta',
      'Cápsula',
      'Jarabe',
      'Crema',
      'Solución',
      'Inyectable',
    ]),
    viasAdministracion: buildRecords('VIA', 11, ['Oral', 'Tópica', 'Intramuscular', 'Intravenosa']),
    concentraciones: buildRecords('CON', 20, ['500 mg', '250 mg/5 ml', '10 mg', '20 mg']),
    condicionVenta: buildRecords('CV', 6, ['Libre', 'Con receta', 'Controlado']),
    tipoMedicamento: buildRecords('TM', 8, ['Genérico', 'Marca', 'Biológico']),
    presentaciones: buildRecords('PRE', 18, ['Caja x10', 'Caja x20', 'Frasco 100 ml', 'Blister x10']),
    unidadesMedida: buildRecords('UNI', 14, ['UND', 'ML', 'G', 'FRASCO', 'SOBRE']),
    tiposEmpaque: buildRecords('EMP', 9, ['Caja', 'Blister', 'Frasco', 'Ampolla']),
    condicionesConservacion: buildRecords('CC', 5, ['Ambiente', 'Refrigerado', 'Cadena de frío']),
    impuestos: buildRecords('IMP', 4, ['IGV 18%', 'Exonerado']),
    estadosProducto: buildRecords('EST', 3, ['ACTIVO', 'INACTIVO', 'DESCONTINUADO']),
    codigosBarras: buildRecords('BAR', 4, ['EAN-13', 'UPC-A']),
  }
}

export function getCatalogConfig(key: MasterCatalogKey) {
  return masterCatalogs.find((item) => item.key === key) ?? masterCatalogs[0]
}
