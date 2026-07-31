[OPEN] Debug Session: backend-endpoint-validation

Objetivo
- Validar endpoints críticos del backend contra el schema.prisma actual y asegurar compatibilidad con el frontend.

Síntoma
- Errores de runtime en frontend tipo ".map of undefined" y/o errores Prisma por campos/relaciones inexistentes.

Reglas
- No modificar schema.prisma ni la base de datos.
- Si un endpoint puede devolver colecciones vacías, debe devolver [] (no undefined).

Evidencia
- Pending.

Hipótesis
- Pending.

Cambios
- Pending.

Verificación
- Pending.

