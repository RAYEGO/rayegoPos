export type StockAlertLevel = 'critical' | 'low' | 'normal' | 'outOfStock'

export type StockAlertLevelLabel = 'Crítico' | 'Bajo' | 'Normal' | 'Sin stock'

export type StockAlertVariant = 'destructive' | 'warning' | 'success' | 'outline'

export type StockThresholdConfigInput = {
  enabled: boolean
  criticalMax: number
  lowMax: number
}

export type StockThresholdConfig = StockThresholdConfigInput & {
  updatedAt: string | null
  scope: 'company' | 'branch'
  scopeId: string
}

export type StockThresholdOverrideInput = {
  productId: string
  criticalMax?: number | null
  lowMax?: number | null
}

export type StockThresholdOverrideRecord = StockThresholdOverrideInput & {
  updatedAt: string
}

export type StockThresholdResolverInput = {
  stockUnits: number
  companyConfig: StockThresholdConfig | null
  branchConfig?: StockThresholdConfig | null
  productOverride?: StockThresholdOverrideRecord | null
  fallbackToLegacyDefaults?: boolean
}

export type StockThresholdEvaluation = {
  level: StockAlertLevel
  levelLabel: StockAlertLevelLabel
  variant: StockAlertVariant
  dotColor: string
  badgeColor: string
  badgeBg: string
  requiresUrgentReposition: boolean
  recommendsReposition: boolean
  thresholdsUsed: EffectiveStockThresholds
}

const STORAGE_PREFIX = 'rayego-pos.stock-thresholds'
const LEGACY_STOCK_LOW_MAX = 20
const LEGACY_STOCK_CRITICAL_MAX = 0

export const DEFAULT_STOCK_ALERT_CONFIG: Omit<StockThresholdConfig, 'updatedAt' | 'scope' | 'scopeId'> = {
  enabled: true,
  criticalMax: 5,
  lowMax: 10,
}

export const STOCK_ALERT_EXAMPLES = {
  critical: {
    rangeLabel: '0 – X',
    description: 'requiere reposición urgente',
  },
  low: {
    rangeLabel: 'X+1 – Y',
    description: 'considerar reposición',
  },
  normal: {
    rangeLabel: 'Y+1 en adelante',
    description: 'stock suficiente',
  },
  outOfStock: {
    description: 'agotado — requiere reposición inmediata',
  },
} as const

function safeRound(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.trunc(value) === value
}

export function validateStockThresholdConfig(input: StockThresholdConfigInput): { ok: true } | { ok: false; errors: { criticalMax?: string; lowMax?: string } } {
  const errors: { criticalMax?: string; lowMax?: string } = {}
  const criticalMax = typeof input.criticalMax === 'string' ? Number(input.criticalMax) : input.criticalMax
  const lowMax = typeof input.lowMax === 'string' ? Number(input.lowMax) : input.lowMax
  if (!isNonNegativeInteger(criticalMax)) errors.criticalMax = 'El valor debe ser un número entero mayor o igual a 0.'
  if (!isNonNegativeInteger(lowMax)) errors.lowMax = 'El valor debe ser un número entero mayor o igual a 0.'
  if (isNonNegativeInteger(criticalMax) && isNonNegativeInteger(lowMax) && criticalMax >= lowMax) {
    errors.lowMax = 'Stock bajo debe ser estrictamente mayor que stock crítico.'
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true }
}

function normalizeAndValidateConfig(input: Partial<StockThresholdConfigInput>): StockThresholdConfigInput | null {
  const enabled = typeof input?.enabled === 'boolean' ? input.enabled : DEFAULT_STOCK_ALERT_CONFIG.enabled
  const criticalMax = typeof input?.criticalMax === 'number' ? safeRound(input.criticalMax) : DEFAULT_STOCK_ALERT_CONFIG.criticalMax
  const lowMax = typeof input?.lowMax === 'number' ? safeRound(input.lowMax) : DEFAULT_STOCK_ALERT_CONFIG.lowMax
  const valid = validateStockThresholdConfig({ enabled, criticalMax, lowMax })
  if (!valid.ok) return null
  return { enabled, criticalMax, lowMax }
}

function authScopeNamespace(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const authKeys = ['rayego-auth.session', 'rayego-pos.auth.session']
    for (const key of authKeys) {
      const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const companyId = parsed?.companyId ?? parsed?.company?.id ?? parsed?.empresaId ?? null
      if (companyId) return String(companyId)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function stockThresholdCompanyStorageKey(companyId?: string | null): string {
  const scopeId = companyId ?? authScopeNamespace() ?? 'default'
  return `${STORAGE_PREFIX}.company.${scopeId}`
}

export function stockThresholdBranchStorageKey(branchId: string, companyId?: string | null): string {
  const companyScope = companyId ?? authScopeNamespace() ?? 'default'
  return `${STORAGE_PREFIX}.branch.${companyScope}.${branchId}`
}

export function stockThresholdOverrideStorageKey(companyId?: string | null): string {
  const scopeId = companyId ?? authScopeNamespace() ?? 'default'
  return `${STORAGE_PREFIX}.overrides.${scopeId}`
}

function readStorage(key: string): unknown | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadStockThresholdCompanyConfig(companyId?: string | null): StockThresholdConfig | null {
  const key = stockThresholdCompanyStorageKey(companyId)
  const raw = readStorage(key)
  if (!raw || typeof raw !== 'object') return null
  const normalized = normalizeAndValidateConfig(raw as Partial<StockThresholdConfigInput>)
  if (!normalized) return null
  return {
    ...normalized,
    updatedAt: typeof (raw as any).updatedAt === 'string' ? (raw as any).updatedAt : null,
    scope: 'company',
    scopeId: companyId ?? authScopeNamespace() ?? 'default',
  }
}

export function loadStockThresholdBranchConfig(branchId: string, companyId?: string | null): StockThresholdConfig | null {
  const key = stockThresholdBranchStorageKey(branchId, companyId)
  const raw = readStorage(key)
  if (!raw || typeof raw !== 'object') return null
  const normalized = normalizeAndValidateConfig(raw as Partial<StockThresholdConfigInput>)
  if (!normalized) return null
  return {
    ...normalized,
    updatedAt: typeof (raw as any).updatedAt === 'string' ? (raw as any).updatedAt : null,
    scope: 'branch',
    scopeId: branchId,
  }
}

export function saveStockThresholdCompanyConfig(
  input: StockThresholdConfigInput,
  companyId?: string | null,
): StockThresholdConfig | null {
  const normalized = normalizeAndValidateConfig(input)
  if (!normalized) return null
  const saved: StockThresholdConfig = {
    ...normalized,
    updatedAt: new Date().toISOString(),
    scope: 'company',
    scopeId: companyId ?? authScopeNamespace() ?? 'default',
  }
  const key = stockThresholdCompanyStorageKey(companyId)
  writeStorage(key, saved)
  return saved
}

export function saveStockThresholdBranchConfig(
  branchId: string,
  input: StockThresholdConfigInput,
  companyId?: string | null,
): StockThresholdConfig | null {
  const normalized = normalizeAndValidateConfig(input)
  if (!normalized) return null
  const saved: StockThresholdConfig = {
    ...normalized,
    updatedAt: new Date().toISOString(),
    scope: 'branch',
    scopeId: branchId,
  }
  const key = stockThresholdBranchStorageKey(branchId, companyId)
  writeStorage(key, saved)
  return saved
}

export function loadStockThresholdOverrides(companyId?: string | null): StockThresholdOverrideRecord[] {
  const key = stockThresholdOverrideStorageKey(companyId)
  const raw = readStorage(key)
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is StockThresholdOverrideRecord => {
    if (!entry || typeof entry !== 'object') return false
    if (typeof (entry as any).productId !== 'string') return false
    const crit = (entry as any).criticalMax
    const low = (entry as any).lowMax
    if (crit !== null && crit !== undefined && !isNonNegativeInteger(crit)) return false
    if (low !== null && low !== undefined && !isNonNegativeInteger(low)) return false
    if (isNonNegativeInteger(crit) && isNonNegativeInteger(low) && crit >= low) return false
    return true
  })
}

export function saveStockThresholdOverride(
  entry: StockThresholdOverrideInput,
  companyId?: string | null,
): StockThresholdOverrideRecord | null {
  const crit = entry.criticalMax ?? null
  const low = entry.lowMax ?? null
  if (crit === null && low === null) return null
  if (isNonNegativeInteger(crit) && isNonNegativeInteger(low) && crit >= low) return null
  const all = loadStockThresholdOverrides(companyId)
  const record: StockThresholdOverrideRecord = {
    productId: entry.productId,
    criticalMax: crit,
    lowMax: low,
    updatedAt: new Date().toISOString(),
  }
  const next = all.filter((r) => r.productId !== entry.productId).concat([record])
  const key = stockThresholdOverrideStorageKey(companyId)
  writeStorage(key, next)
  return record
}

export function getStockThresholdOverrideForProduct(
  productId: string,
  companyId?: string | null,
): StockThresholdOverrideRecord | null {
  return loadStockThresholdOverrides(companyId).find((entry) => entry.productId === productId) ?? null
}

export type EffectiveStockThresholds = {
  source: 'override' | 'branch' | 'company' | 'legacy-defaults' | 'alerts-disabled'
  criticalMax: number | null
  lowMax: number | null
  enabled: boolean
}

export function resolveEffectiveStockThresholds(
  input: Pick<StockThresholdResolverInput, 'companyConfig' | 'branchConfig' | 'productOverride' | 'fallbackToLegacyDefaults'>,
): EffectiveStockThresholds {
  const { companyConfig, branchConfig, productOverride } = input
  const fallbackEnabled = input.fallbackToLegacyDefaults !== false
  if (productOverride && (productOverride.criticalMax !== null || productOverride.lowMax !== null)) {
    const effectiveCompanyOrBranch = branchConfig ?? companyConfig
    const base =
      productOverride.criticalMax !== null && productOverride.lowMax !== null
        ? {
            enabled: true,
            criticalMax: productOverride.criticalMax ?? null,
            lowMax: productOverride.lowMax ?? null,
          }
        : {
            enabled: effectiveCompanyOrBranch?.enabled ?? DEFAULT_STOCK_ALERT_CONFIG.enabled,
            criticalMax:
              productOverride.criticalMax ??
              (effectiveCompanyOrBranch?.criticalMax ?? DEFAULT_STOCK_ALERT_CONFIG.criticalMax) ??
              null,
            lowMax:
              productOverride.lowMax ??
              (effectiveCompanyOrBranch?.lowMax ?? DEFAULT_STOCK_ALERT_CONFIG.lowMax) ??
              null,
          }
    return {
      source: 'override',
      enabled: Boolean(base.enabled),
      criticalMax: Number.isFinite(base.criticalMax) ? Math.max(0, Math.floor(base.criticalMax as number)) : null,
      lowMax: Number.isFinite(base.lowMax) ? Math.max(0, Math.floor(base.lowMax as number)) : null,
    }
  }
  if (branchConfig) {
    return {
      source: 'branch',
      enabled: Boolean(branchConfig.enabled),
      criticalMax: Number.isFinite(branchConfig.criticalMax) ? Math.max(0, Math.floor(branchConfig.criticalMax)) : null,
      lowMax: Number.isFinite(branchConfig.lowMax) ? Math.max(0, Math.floor(branchConfig.lowMax)) : null,
    }
  }
  if (companyConfig) {
    return {
      source: 'company',
      enabled: Boolean(companyConfig.enabled),
      criticalMax: Number.isFinite(companyConfig.criticalMax) ? Math.max(0, Math.floor(companyConfig.criticalMax)) : null,
      lowMax: Number.isFinite(companyConfig.lowMax) ? Math.max(0, Math.floor(companyConfig.lowMax)) : null,
    }
  }
  if (fallbackEnabled) {
    return {
      source: 'legacy-defaults',
      enabled: true,
      criticalMax: LEGACY_STOCK_CRITICAL_MAX,
      lowMax: LEGACY_STOCK_LOW_MAX,
    }
  }
  return { source: 'alerts-disabled', enabled: false, criticalMax: null, lowMax: null }
}

export function evaluateStockLevel(input: StockThresholdResolverInput): StockThresholdEvaluation {
  const stockUnits = safeRound(input.stockUnits)
  const effective = resolveEffectiveStockThresholds(input)
  const { enabled, criticalMax, lowMax } = effective

  if (!enabled || criticalMax === null || lowMax === null) {
    return {
      level: 'normal',
      levelLabel: 'Normal',
      variant: 'success',
      dotColor: 'bg-emerald-500',
      badgeColor: 'text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      requiresUrgentReposition: false,
      recommendsReposition: false,
      thresholdsUsed: effective,
    }
  }

  if (stockUnits === 0) {
    return {
      level: 'outOfStock',
      levelLabel: 'Sin stock',
      variant: 'destructive',
      dotColor: 'bg-rose-600',
      badgeColor: 'text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-500/10',
      requiresUrgentReposition: true,
      recommendsReposition: true,
      thresholdsUsed: effective,
    }
  }
  if (stockUnits <= criticalMax) {
    return {
      level: 'critical',
      levelLabel: 'Crítico',
      variant: 'destructive',
      dotColor: 'bg-rose-500',
      badgeColor: 'text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-500/10',
      requiresUrgentReposition: true,
      recommendsReposition: true,
      thresholdsUsed: effective,
    }
  }
  if (stockUnits <= lowMax) {
    return {
      level: 'low',
      levelLabel: 'Bajo',
      variant: 'warning',
      dotColor: 'bg-amber-500',
      badgeColor: 'text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-50 dark:bg-amber-500/10',
      requiresUrgentReposition: false,
      recommendsReposition: true,
      thresholdsUsed: effective,
    }
  }
  return {
    level: 'normal',
    levelLabel: 'Normal',
    variant: 'success',
    dotColor: 'bg-emerald-500',
    badgeColor: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    requiresUrgentReposition: false,
    recommendsReposition: false,
    thresholdsUsed: effective,
  }
}

export function buildStockAlertRangeLabels(config: StockThresholdConfigInput) {
  const { enabled, criticalMax, lowMax } = config
  if (!enabled) {
    return {
      critical: null,
      low: null,
      normal: { label: 'Alertas desactivadas' },
      outOfStock: null,
    }
  }
  return {
    critical: { label: `0 – ${criticalMax}` },
    low: { label: `${criticalMax + 1} – ${lowMax}` },
    normal: { label: `${lowMax + 1}+` },
    outOfStock: { label: `0 (agotado)` },
  }
}

export function stockThresholdToVariant(
  evaluation: StockThresholdEvaluation,
  options: { honorDisabled?: boolean; legacyCompatibility?: boolean } = {},
): StockAlertVariant {
  if (options.legacyCompatibility) {
    if (evaluation.level === 'outOfStock') return 'destructive'
    if (evaluation.level === 'critical' || evaluation.level === 'low') return 'warning'
    return 'success'
  }
  if (evaluation.thresholdsUsed.enabled === false && options.honorDisabled !== false) return 'outline'
  return evaluation.variant
}
