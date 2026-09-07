import { useMemo } from 'react'
import type { AuthSession } from '@/types/auth'
import {
  BUSINESS_FEATURES,
  getBusinessType,
  isFeatureEnabledForBusiness,
  type BusinessFeatureKey,
  type BusinessType,
} from '@/config/features'
import { useAuth } from '@/hooks/useAuth'

type UseBusinessFeaturesReturn = {
  businessType: BusinessType
  enabledFeatures: ReadonlySet<BusinessFeatureKey>
  isFeatureEnabled: (feature: BusinessFeatureKey) => boolean
  session: AuthSession | null
}

export function useBusinessFeatures(): UseBusinessFeaturesReturn {
  const { session } = useAuth()
  return useMemo<UseBusinessFeaturesReturn>(() => {
    const businessType = getBusinessType(session)
    const enabledFeatures = new Set<BusinessFeatureKey>()
    ;(Object.keys(BUSINESS_FEATURES) as BusinessFeatureKey[]).forEach((f) => {
      if (isFeatureEnabledForBusiness(f, businessType)) enabledFeatures.add(f)
    })
    return {
      businessType,
      enabledFeatures,
      isFeatureEnabled: (feature) => enabledFeatures.has(feature),
      session,
    }
  }, [session])
}
