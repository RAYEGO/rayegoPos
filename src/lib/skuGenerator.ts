export const DEFAULT_SKU_CATEGORY_PREFIXES: Readonly<Record<string, string>> = {
  Medicamentos: 'MED',
  Analgesicos: 'MED',
  Analgésicos: 'MED',
  Antibioticos: 'MED',
  Antibióticos: 'MED',
  Antiinflamatorios: 'MED',
  Antihistaminicos: 'MED',
  Antihistamínicos: 'MED',
  Cardiovasculares: 'MED',
  Gastrointestinales: 'MED',
  Respiratorios: 'MED',
  Vitaminas: 'MED',
  Suplementos: 'MED',
  Bebidas: 'BEB',
  'Cuidado Personal': 'CUI',
  CuidadoPersonal: 'CUI',
  Cuidado_personal: 'CUI',
  Higiene: 'HIG',
  Alimentos: 'ALI',
  'Dispositivos Medicos': 'DIS',
  'Dispositivos Médicos': 'DIS',
  Dispositivos: 'DIS',
  'Utiles y Papeleria': 'UTL',
  'Útiles y Papelería': 'UTL',
  Utiles: 'UTL',
  Papeleria: 'UTL',
  Papelería: 'UTL',
  Accesorios: 'ACC',
  Otros: 'OTR',
  Otro: 'OTR',
}

export const FALLBACK_SKU_PREFIX = 'OTR'
export const SKU_SEPARATOR = '-'
export const SKU_NUMBER_PAD = 6
const STORAGE_PREFIX = 'rayego-pos.sku'
const PREFIX_MAP_KEY = `${STORAGE_PREFIX}.category-prefixes`
const PREFIX_COUNTERS_KEY = `${STORAGE_PREFIX}.prefix-counters`
const RESERVED_SKUS_KEY = `${STORAGE_PREFIX}.reserved`
const IN_MEMORY_PREFIX = '__memory-'

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore storage errors */
  }
}

function authScopeNamespace(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const authKeys = ['rayego-auth.session', 'rayego-pos.auth.session']
    for (const key of authKeys) {
      const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const companyId =
        parsed?.user?.companyId ??
        parsed?.companyId ??
        parsed?.company?.id ??
        parsed?.empresaId ??
        null
      if (companyId) return String(companyId)
    }
  } catch {
    /* ignore */
  }
  return null
}

export const DEFAULT_SKU_COUNTERS: Readonly<Record<string, number>> = {}

export type SkuPrefixMapEntry = {
  categoryId?: string
  categoryName: string
  prefix: string
  updatedAt?: string | null
}

export type SkuPrefixCounters = Record<string, number>

export type ReservedSkuRecord = {
  sku: string
  reservedAt: string
  consumedBy?: string | null
  status: 'reserved' | 'consumed' | 'discarded'
}

export const SKU_PREFIX_REGEX = /^[A-ZÑ0-9]{1,6}$/

export function normalizeSkuPrefix(raw?: string | null): string {
  if (!raw) return FALLBACK_SKU_PREFIX
  const cleaned = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-ZÑ0-9]/g, '')
    .slice(0, 6)
  return cleaned || FALLBACK_SKU_PREFIX
}

export function validateSkuPrefix(prefix?: string | null): { ok: true } | { ok: false; error: string } {
  const normalized = normalizeSkuPrefix(prefix)
  if (!SKU_PREFIX_REGEX.test(normalized)) {
    return { ok: false, error: 'El prefijo debe ser 1-6 letras mayúsculas o dígitos (sin espacios ni acentos).' }
  }
  return { ok: true }
}

function suggestSkuPrefixByName(categoryName: string, overrides?: Record<string, string> | null): string {
  const name = (categoryName ?? '').trim()
  if (!name) return FALLBACK_SKU_PREFIX
  const dictionary = { ...DEFAULT_SKU_CATEGORY_PREFIXES, ...(overrides ?? {}) }
  const cleanLookup = (input: string) =>
    input
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
  const cleanedName = cleanLookup(name)
  for (const key of Object.keys(dictionary)) {
    if (cleanLookup(key) === cleanedName) return normalizeSkuPrefix(dictionary[key])
  }
  const tokens = cleanedName.split(/[\s\-_/\\&,]+/).filter(Boolean)
  if (tokens.length <= 1) {
    return normalizeSkuPrefix(tokens[0]?.slice(0, 3) ?? FALLBACK_SKU_PREFIX)
  }
  const upTo3 = tokens.slice(0, 3)
  return normalizeSkuPrefix(upTo3.map((t) => t[0] ?? '').join(''))
}

function scopeKeySuffix(companyId?: string | null): string {
  return companyId ?? authScopeNamespace() ?? 'default'
}

function prefixMapStorageKey(companyId?: string | null): string {
  return `${PREFIX_MAP_KEY}.${scopeKeySuffix(companyId)}`
}

function prefixCounterStorageKey(companyId?: string | null): string {
  return `${PREFIX_COUNTERS_KEY}.${scopeKeySuffix(companyId)}`
}

function reservedSkusStorageKey(companyId?: string | null): string {
  return `${RESERVED_SKUS_KEY}.${scopeKeySuffix(companyId)}`
}

export function loadSkuPrefixMap(companyId?: string | null): SkuPrefixMapEntry[] {
  const raw = readStorage<SkuPrefixMapEntry[]>(prefixMapStorageKey(companyId))
  if (!Array.isArray(raw)) return []
  return raw
}

export function getSkuPrefixForCategory(params: {
  categoryId?: string | null
  categoryName?: string | null
  companyId?: string | null
  overridesGlobal?: Record<string, string> | null
}): string {
  const { categoryId, categoryName, companyId, overridesGlobal } = params
  if (categoryId) {
    const saved = loadSkuPrefixMap(companyId).find((entry) => entry.categoryId === categoryId)
    if (saved?.prefix) return normalizeSkuPrefix(saved.prefix)
  }
  if (categoryName) {
    const byName = loadSkuPrefixMap(companyId).find(
      (entry) =>
        (entry.categoryName ?? '').trim().toLowerCase() ===
        String(categoryName).trim().toLowerCase(),
    )
    if (byName?.prefix) return normalizeSkuPrefix(byName.prefix)
  }
  const fromDictionary = categoryName ? suggestSkuPrefixByName(categoryName, overridesGlobal) : null
  if (fromDictionary && fromDictionary !== FALLBACK_SKU_PREFIX) return fromDictionary
  return normalizeSkuPrefix(fromDictionary ?? FALLBACK_SKU_PREFIX)
}

export function saveSkuPrefixForCategory(
  entry: SkuPrefixMapEntry,
  companyId?: string | null,
): SkuPrefixMapEntry {
  const all = loadSkuPrefixMap(companyId)
  const normalized: SkuPrefixMapEntry = {
    ...entry,
    prefix: normalizeSkuPrefix(entry.prefix),
    updatedAt: new Date().toISOString(),
  }
  const idx = all.findIndex((e) =>
    entry.categoryId ? e.categoryId === entry.categoryId : e.categoryName === entry.categoryName,
  )
  if (idx >= 0) all[idx] = normalized
  else all.push(normalized)
  writeStorage(prefixMapStorageKey(companyId), all)
  return normalized
}

export function loadSkuPrefixCounters(companyId?: string | null): SkuPrefixCounters {
  const raw = readStorage<SkuPrefixCounters>(prefixCounterStorageKey(companyId))
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return { ...DEFAULT_SKU_COUNTERS }
  return Object.fromEntries(
    Object.entries(raw).filter(([k, v]) => SKU_PREFIX_REGEX.test(k) && Number.isFinite(v) && v >= 0),
  ) as SkuPrefixCounters
}

export function saveSkuPrefixCounters(counters: SkuPrefixCounters, companyId?: string | null): void {
  writeStorage(prefixCounterStorageKey(companyId), counters)
}

export function loadReservedSkus(companyId?: string | null): ReservedSkuRecord[] {
  const raw = readStorage<ReservedSkuRecord[]>(reservedSkusStorageKey(companyId))
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (r) => r && typeof r.sku === 'string' && typeof r.reservedAt === 'string',
  )
}

export function saveReservedSkus(records: ReservedSkuRecord[], companyId?: string | null): void {
  writeStorage(reservedSkusStorageKey(companyId), records)
}

export function padSkuNumber(value: number, pad = SKU_NUMBER_PAD): string {
  const safe = Math.max(0, Math.floor(Number(value) || 0))
  return String(safe).padStart(pad, '0')
}

export function buildSku(prefix: string, sequence: number, pad = SKU_NUMBER_PAD): string {
  return `${normalizeSkuPrefix(prefix)}${SKU_SEPARATOR}${padSkuNumber(sequence, pad)}`
}

export function parseSku(
  sku: string,
): { prefix: string; number: number; raw: string } | null {
  if (!sku) return null
  const idx = sku.indexOf(SKU_SEPARATOR)
  if (idx < 0) return null
  const prefix = sku.slice(0, idx)
  const numberStr = sku.slice(idx + SKU_SEPARATOR.length).replace(/[^0-9]/g, '')
  if (!numberStr) return null
  const number = Number(numberStr)
  if (!Number.isFinite(number)) return null
  return { prefix, number, raw: sku }
}

export function isSkuReservedOrConsumed(
  sku: string,
  params: {
    existingSkus?: ReadonlyArray<string> | ReadonlySet<string> | null
    companyId?: string | null
  } = {},
): boolean {
  if (!sku) return true
  const { existingSkus, companyId } = params
  if (existingSkus instanceof Set) {
    if (existingSkus.has(sku)) return true
  } else if (Array.isArray(existingSkus)) {
    if (existingSkus.includes(sku)) return true
  }
  const records = loadReservedSkus(companyId)
  return records.some(
    (r) => r.sku === sku && (r.status === 'reserved' || r.status === 'consumed'),
  )
}

export function reserveNextSku(params: {
  prefix: string
  existingSkus?: ReadonlyArray<string> | ReadonlySet<string> | null
  companyId?: string | null
  existingMaxByPrefix?: Readonly<Record<string, number>> | null
}): { sku: string; prefix: string; sequence: number } {
  const { prefix, existingSkus, companyId, existingMaxByPrefix } = params
  const normalizedPrefix = normalizeSkuPrefix(prefix)
  const counters = loadSkuPrefixCounters(companyId)
  const reserved = loadReservedSkus(companyId)
  const consumedNumbers = new Map<string, Set<number>>()
  const ensureBucket = (p: string) => {
    if (!consumedNumbers.has(p)) consumedNumbers.set(p, new Set<number>())
    return consumedNumbers.get(p)!
  }
  if (existingSkus) {
    const list = existingSkus instanceof Set ? Array.from(existingSkus) : existingSkus
    for (const sku of list) {
      const parsed = parseSku(sku)
      if (!parsed) continue
      ensureBucket(normalizeSkuPrefix(parsed.prefix)).add(parsed.number)
    }
  }
  for (const r of reserved) {
    if (r.status === 'discarded') continue
    const parsed = parseSku(r.sku)
    if (!parsed) continue
    ensureBucket(normalizeSkuPrefix(parsed.prefix)).add(parsed.number)
  }
  let start = Math.max(
    counters[normalizedPrefix] ?? 0,
    existingMaxByPrefix?.[normalizedPrefix] ?? 0,
  )
  const used = ensureBucket(normalizedPrefix)
  let candidate = start + 1
  while (used.has(candidate) || candidate <= 0) {
    candidate += 1
  }
  const sku = buildSku(normalizedPrefix, candidate)
  counters[normalizedPrefix] = candidate
  saveSkuPrefixCounters(counters, companyId)
  saveReservedSkus(
    [
      ...reserved.filter((r) => r.sku !== sku),
      { sku, reservedAt: new Date().toISOString(), status: 'reserved' as const, consumedBy: null },
    ],
    companyId,
  )
  return { sku, prefix: normalizedPrefix, sequence: candidate }
}

export function consumeReservedSku(sku: string, consumerId: string, companyId?: string | null): void {
  if (!sku) return
  const records = loadReservedSkus(companyId)
  const updated = records.map((r) =>
    r.sku === sku ? { ...r, status: 'consumed' as const, consumedBy: consumerId } : r,
  )
  saveReservedSkus(updated, companyId)
}

export function discardReservedSku(sku: string, companyId?: string | null): void {
  if (!sku) return
  const records = loadReservedSkus(companyId)
  const updated = records.map((r) =>
    r.sku === sku ? { ...r, status: 'discarded' as const } : r,
  )
  saveReservedSkus(updated, companyId)
}

export function generateNextSkuForCategory(params: {
  categoryId?: string | null
  categoryName?: string | null
  existingSkus?: ReadonlyArray<string> | ReadonlySet<string> | null
  existingMaxByPrefix?: Readonly<Record<string, number>> | null
  companyId?: string | null
  overridesGlobal?: Record<string, string> | null
}): { sku: string; prefix: string; sequence: number } {
  const prefix = getSkuPrefixForCategory({
    categoryId: params.categoryId,
    categoryName: params.categoryName,
    companyId: params.companyId,
    overridesGlobal: params.overridesGlobal,
  })
  return reserveNextSku({
    prefix,
    existingSkus: params.existingSkus,
    existingMaxByPrefix: params.existingMaxByPrefix,
    companyId: params.companyId,
  })
}

export function buildSkuSuggestionForCategory(
  params: {
    categoryId?: string | null
    categoryName?: string | null
    companyId?: string | null
    overridesGlobal?: Record<string, string> | null
  },
  pad = SKU_NUMBER_PAD,
): string {
  const prefix = getSkuPrefixForCategory(params)
  const counters = loadSkuPrefixCounters(params.companyId)
  const next = (counters[prefix] ?? 0) + 1
  return buildSku(prefix, next, pad)
}

export function legacySkuMigrationSuggestion(currentSku: string, categoryName?: string | null): string {
  const parsed = parseSku(currentSku)
  if (!parsed || parsed.prefix !== 'MED') return currentSku
  const newPrefix = suggestSkuPrefixByName(categoryName ?? 'Otro')
  return buildSku(newPrefix, parsed.number)
}

export function ensureCountersFromExistingSkus(
  existingSkus: ReadonlyArray<string> | ReadonlySet<string>,
  companyId?: string | null,
): Record<string, number> {
  const list = existingSkus instanceof Set ? Array.from(existingSkus) : existingSkus
  const maxByPrefix: Record<string, number> = {}
  for (const sku of list) {
    const parsed = parseSku(sku)
    if (!parsed) continue
    const prefix = normalizeSkuPrefix(parsed.prefix)
    if (!maxByPrefix[prefix] || parsed.number > maxByPrefix[prefix]) {
      maxByPrefix[prefix] = parsed.number
    }
  }
  const counters = loadSkuPrefixCounters(companyId)
  let changed = false
  for (const [prefix, max] of Object.entries(maxByPrefix)) {
    if (!counters[prefix] || counters[prefix] < max) {
      counters[prefix] = max
      changed = true
    }
  }
  if (changed) saveSkuPrefixCounters(counters, companyId)
  return maxByPrefix
}

if (typeof window !== 'undefined') {
  const key = `${IN_MEMORY_PREFIX}${STORAGE_PREFIX}.initialized`
  if (!(window as any)[key]) {
    ;(window as any)[key] = true
  }
}
