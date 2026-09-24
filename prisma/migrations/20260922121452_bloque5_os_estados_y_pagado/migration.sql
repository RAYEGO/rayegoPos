-- =================================================================
-- BLOQUE 5: ESTADOS OFICIALES ÓRDENES DE SERVICIO + PAGADO
-- Estrategia CONSERVADORA post-auditoría T0 (2026-09-22):
--   NO RENAME ni UPDATE de datos históricos.
--   SOLO se AGREGAN los 10 valores oficiales nuevos (9 pasos + PAGADO).
--     NOTA: ENTREGADO ya existía en migración rt_v1 (legacy). Se preserva.
--   Valores LEGACY (RECIBIDO, DIAGNOSTICO, PRESUPUESTO, ESPERANDO_APROBACION,
--     APROBADO, EN_PRUEBAS, LISTO_PARA_ENTREGA, PENDIENTE_RETIRO, etc.)
--     se MANTIENEN intactos para código anterior.
--   El VALIDADOR central Bloque5 (isValidEstadoTransitionOS) garantizará que
--   los flujos NUEVOS usen solo los 10 oficiales.
-- =================================================================

-- 8 valores oficiales nuevos (ENTREGADO ya existía en legacy; PAGADO nuevo)
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'RECEPCIONADO';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'EN_DIAGNOSTICO';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'PRESUPUESTADO';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'ESPERANDO_AUTORIZACION';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'EN_REPARACION';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'TRABAJO_TERMINADO';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'LISTO_PARA_COBRO';
ALTER TYPE "EstadoOrdenServicio" ADD VALUE IF NOT EXISTS 'PAGADO';

-- =================================================================
-- IMPORTANTE (OQ1 post T0 Auditoría 2026-09-22):
-- NO se ejecuta UPDATE de ordenes_servicio.estado_actual para migrar data existente, porque:
--   1. Railway DEV contiene 0 registros hoy (count ordenes_servicio = 0).
--   2. 4 equivalencias NO son 100% semánticamente iguales (APROBADO ≠ EN_REPARACION;
--      PENDIENTE_RETIRO ≠ PAGADO sin pago real; EN_PRUEBAS ≠ TRABAJO_TERMINADO;
--      LISTO_PARA_ENTREGA ≠ LISTO_PARA_COBRO).
--   3. Driver Bloque5 OQ1 prohíbe sobrescribir información histórica.
-- Si en el futuro (post-migrate deploy) hubiera registros legacy vivos,
-- se puede correr un UPDATE CASE WHEN voluntario (no automático) con aprobación explícita.
-- =================================================================
