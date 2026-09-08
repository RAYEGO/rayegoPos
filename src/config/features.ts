import type { AuthSession } from '@/types/auth'

export type BusinessType = 'BOTICA' | 'SERVICIO_TECNICO' | 'PLATAFORMA'

export type BusinessFeatureKey =
  | 'module_ordenes_servicio'
  | 'module_tecnicos'
  | 'customers_tab_equipment'
  | 'customers_tab_st_orders'
  | 'customers_tab_os_payments'
  | 'customers_tab_warranties'
  | 'inventory_tab_consumption_st'
  | 'config_tab_equipment_types'
  | 'config_tab_service_types'
  | 'config_section_technical_service'
  | 'reports_section_technical_service'
  | 'cashier_tab_os_payments'
  | 'admin_module_technical_service'
  | 'dashboard_card_technical_service'

export type FeatureMatrix = Readonly<Record<BusinessFeatureKey, Readonly<BusinessType[]>>>

export const BUSINESS_FEATURES: FeatureMatrix = {
  module_ordenes_servicio: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  module_tecnicos: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  customers_tab_equipment: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  customers_tab_st_orders: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  customers_tab_os_payments: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  customers_tab_warranties: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  inventory_tab_consumption_st: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  config_tab_equipment_types: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  config_tab_service_types: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  config_section_technical_service: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  reports_section_technical_service: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  cashier_tab_os_payments: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  admin_module_technical_service: ['SERVICIO_TECNICO', 'PLATAFORMA'],
  dashboard_card_technical_service: ['SERVICIO_TECNICO', 'PLATAFORMA'],
} as const

export const MODULE_CODE_TO_FEATURE: Readonly<Record<string, BusinessFeatureKey>> = {
  ordenesServicio: 'module_ordenes_servicio',
  tecnicos: 'module_tecnicos',
} as const

export function getBusinessType(session: AuthSession | null): BusinessType {
  if (!session) return 'BOTICA'
  const code = (session.user.companyTypeCode ?? '').trim().toUpperCase()
  if (code === 'PLATAFORMA') return 'PLATAFORMA'
  if (code === 'SERVICIO_TECNICO' || code === 'RAYEGOTECH') return 'SERVICIO_TECNICO'
  return 'BOTICA'
}

export function isFeatureEnabledForBusiness(
  feature: BusinessFeatureKey,
  businessType: BusinessType,
): boolean {
  const enabledFor = BUSINESS_FEATURES[feature]
  if (!enabledFor) return false
  return enabledFor.includes(businessType)
}

export function isFeatureEnabled(
  feature: BusinessFeatureKey,
  session: AuthSession | null,
): boolean {
  const businessType = getBusinessType(session)
  return isFeatureEnabledForBusiness(feature, businessType)
}
