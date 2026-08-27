[OPEN]

## Sesión
- id: admin-pos-edit-logout
- síntoma: al abrir el módulo/flujo de editar (Admin POS → Empresas → Editar) se cierra la sesión
- esperado: mantener sesión y abrir el panel/diálogo de edición sin logout

## Hipótesis (falsables)
- H1: una llamada API nueva al abrir “Editar” responde 401/403 y el manejador de unauthorized está interpretándolo como logout.
- H2: el refresh/token exchange falla (401/400) y provoca limpieza de sesión.
- H3: alguna excepción en cliente (network/error parse) dispara el flujo de logout “sin motivo explícito”.
- H4: hay un endpoint que ahora requiere permisos/rol distinto y retorna 401, causando logout aunque el usuario sea ADMIN_POS.
- H5: el endpoint de logout se invoca por error (ej. request con headers/body inválidos) durante navegación.

## Evidencia a recolectar
- Endpoint exacto que falla antes del logout (método + status + response)
- Función que ejecuta logout/clearSession y por qué (archivo/línea)
- Contexto: ruta, módulo, roles/permissions del session.user al momento del fallo

## Plan (solo diagnóstico al inicio)
1) Instrumentar puntos de: apiRequest → handleUnauthorized → logout/clearSession.
2) Reproducir: Admin POS → Empresas → Editar.
3) Revisar logs del Debug Server y determinar hipótesis confirmada.

