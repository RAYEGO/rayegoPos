# Debug Session: module-white-screen
- **Status**: [OPEN]
- **Issue**: Pantalla en blanco al seleccionar un módulo después del login; error en runtime `Cannot read properties of undefined (reading 'map')`.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-module-white-screen.ndjson

## Reproduction Steps
1. Iniciar sesión.
2. Elegir un módulo desde el menú principal.
3. La pantalla queda en blanco.
4. En consola aparece `Cannot read properties of undefined (reading 'map')`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Un componente renderiza `xxx.map(...)` sobre un dato opcional que llega `undefined` al entrar al módulo (response/props/state). | High | Low | Pending |
| B | Un endpoint devuelve una forma distinta (breaking change) y el frontend asume un array (por ejemplo `options.*` o `rows`). | High | Med | Pending |
| C | La sesión no tiene `companyId/branchId` válido en ese flujo, un request falla y se setea estado incompleto (`undefined`). | Med | Med | Pending |
| D | Un guard/loader de rutas (layout) intenta mapear módulos/permisos y `authorization` o `menuItems` llega `undefined`. | Med | Low | Pending |
| E | Error de import dinámico / code-splitting en producción, y la pantalla se queda en fallback sin datos inicializados. | Low | Med | Pending |

## Log Evidence
- Pendiente: instrumentación y recolección con Debug Server.

## Verification Conclusion
- Pendiente: comparación pre-fix vs post-fix.
