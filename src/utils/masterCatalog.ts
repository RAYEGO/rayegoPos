export function normalizeMasterKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function generateMasterCodeFromName(
  name: string,
  fallback: string,
  maxLength = 30,
) {
  const normalized = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return (normalized || fallback).slice(0, maxLength)
}

export function generateUniqueMasterCode(
  baseCode: string,
  taken: Set<string>,
  maxLength = 30,
) {
  const normalizedBase = baseCode.slice(0, maxLength)
  if (!taken.has(normalizedBase)) return normalizedBase

  for (let attempt = 2; attempt <= 99; attempt += 1) {
    const suffix = `_${attempt}`
    const trimmed = normalizedBase.slice(0, Math.max(1, maxLength - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, maxLength)
    if (!taken.has(candidate)) return candidate
  }

  return normalizedBase
}

export function generateUnitSymbolFromName(name: string) {
  const normalized = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const symbolMap: Record<string, string> = {
    UNIDAD: 'und',
    UNIDADES: 'und',
    TABLETA: 'tab',
    TABLETAS: 'tab',
    CAPSULA: 'cap',
    CAPSULAS: 'cap',
    FRASCO: 'fra',
    FRASCOS: 'fra',
    AMPOLLA: 'amp',
    AMPOLLAS: 'amp',
    SOBRE: 'sob',
    SOBRES: 'sob',
    MILILITRO: 'ml',
    MILILITROS: 'ml',
    LITRO: 'l',
    LITROS: 'l',
    GRAMO: 'g',
    GRAMOS: 'g',
    KILOGRAMO: 'kg',
    KILOGRAMOS: 'kg',
    MILIGRAMO: 'mg',
    MILIGRAMOS: 'mg',
    MICROGRAMO: 'mcg',
    MICROGRAMOS: 'mcg',
  }

  if (!normalized) return 'und'
  const firstToken = normalized.split(' ')[0] ?? ''
  const mapped = symbolMap[normalized] ?? symbolMap[firstToken]
  if (mapped) return mapped

  if (firstToken.length <= 3) return firstToken.toLowerCase()
  return firstToken.slice(0, 3).toLowerCase()
}

export function normalizeUnitSymbol(value: string, maxLength = 20) {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  return normalized.slice(0, maxLength)
}

export function generateUniqueUnitSymbol(
  baseSymbol: string,
  taken: Set<string>,
  maxLength = 20,
) {
  const normalizedBase = normalizeUnitSymbol(baseSymbol, maxLength)
  if (!taken.has(normalizedBase)) return normalizedBase

  for (let attempt = 2; attempt <= 99; attempt += 1) {
    const suffix = `${attempt}`
    const trimmed = normalizedBase.slice(0, Math.max(1, maxLength - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, maxLength)
    if (!taken.has(candidate)) return candidate
  }

  return normalizedBase
}
