import type { CategoryRecord } from './types'

type SeedNode = {
  name: string
  children?: string[]
}

const seed: SeedNode[] = [
  {
    name: 'Medicamentos',
    children: [
      'Analgésicos',
      'Antiinflamatorios',
      'Antibióticos',
      'Antialérgicos',
      'Antigripales',
      'Antitusivos',
      'Expectorantes',
      'Gastrointestinales',
      'Antidiarreicos',
      'Laxantes',
      'Antiparasitarios',
      'Antifúngicos',
      'Antivirales',
      'Antihipertensivos',
      'Antidiabéticos',
      'Cardiovasculares',
      'Respiratorios',
      'Dermatológicos',
      'Oftálmicos',
      'Otológicos',
      'Ginecológicos',
      'Urológicos',
      'Pediátricos',
      'Vitaminas y Suplementos',
      'Anticonceptivos',
    ],
  },
  {
    name: 'Material Médico',
    children: [
      'Algodón',
      'Gasas',
      'Vendas',
      'Curitas',
      'Esparadrapos',
      'Jeringas',
      'Guantes',
      'Mascarillas',
      'Alcohol',
      'Antisépticos',
    ],
  },
  {
    name: 'Cuidado Personal',
    children: [
      'Jabones',
      'Shampoo',
      'Acondicionadores',
      'Cremas',
      'Protector Solar',
      'Desodorantes',
      'Higiene Íntima',
    ],
  },
  {
    name: 'Higiene Bucal',
    children: ['Cepillos Dentales', 'Pasta Dental', 'Enjuague Bucal', 'Hilo Dental'],
  },
  {
    name: 'Bebés',
    children: [
      'Pañales',
      'Toallas Húmedas',
      'Leches Infantiles',
      'Biberones',
      'Chupetes',
      'Cremas para Bebé',
    ],
  },
  {
    name: 'Productos Naturales',
    children: ['Plantas Medicinales', 'Infusiones', 'Aceites Naturales', 'Suplementos Naturales'],
  },
  {
    name: 'Nutrición',
    children: ['Proteínas', 'Vitaminas', 'Suplementos', 'Bebidas Nutricionales'],
  },
  {
    name: 'Equipos Médicos',
    children: ['Termómetros', 'Tensiómetros', 'Glucómetros', 'Oxímetros', 'Nebulizadores'],
  },
  {
    name: 'Productos Complementarios',
    children: ['Agua', 'Galletas', 'Caramelos', 'Chocolates', 'Chicles'],
  },
]

function createRecord(payload: Omit<CategoryRecord, 'id'>): CategoryRecord {
  return { id: crypto.randomUUID(), ...payload }
}

function randomProductCount() {
  return Math.floor(Math.random() * 220)
}

function nowIso() {
  return new Date().toISOString()
}

export function buildBaseCatalog(): CategoryRecord[] {
  const now = nowIso()
  const records: CategoryRecord[] = []
  let seq = 1

  for (const root of seed) {
    const rootRecord = createRecord({
      code: `CAT-${seq.toString().padStart(3, '0')}`,
      name: root.name,
      description: `Categoría principal: ${root.name}.`,
      color: null,
      order: 0,
      parentId: null,
      active: true,
      productCount: randomProductCount(),
      createdAt: now,
      updatedAt: now,
    })
    seq += 1
    records.push(rootRecord)

    for (const childName of root.children ?? []) {
      records.push(
        createRecord({
          code: `CAT-${seq.toString().padStart(3, '0')}`,
          name: childName,
          description: `Subcategoría de ${root.name}: ${childName}.`,
          color: null,
          order: 0,
          parentId: rootRecord.id,
          active: true,
          productCount: randomProductCount(),
          createdAt: now,
          updatedAt: now,
        }),
      )
      seq += 1
    }
  }

  return records
}
