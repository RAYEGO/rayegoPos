import { Badge } from '@/components/ui/badge'
import { roleDefinitionMap } from '@/config/authorization'
import type { AuthRole } from '@/types/auth'

export function RoleBadge({ role }: { role: AuthRole }) {
  const roleDefinition = roleDefinitionMap[role]

  return <Badge variant={roleDefinition.badgeVariant}>{roleDefinition.label}</Badge>
}

