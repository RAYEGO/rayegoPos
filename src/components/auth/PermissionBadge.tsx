import { Badge } from '@/components/ui/badge'
import { permissionDefinitionMap } from '@/config/authorization'
import type { AuthPermission } from '@/types/auth'

export function PermissionBadge({
  permission,
}: {
  permission: Exclude<AuthPermission, '*'>
}) {
  const permissionDefinition = permissionDefinitionMap[permission]

  return <Badge variant="outline">{permissionDefinition.label}</Badge>
}

