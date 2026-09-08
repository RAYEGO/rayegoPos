-- ================================================================
-- RAYEGO TECH — MIGRACIÓN INICIAL (v1)
-- ÓRDENES DE SERVICIO / SERVICIO TÉCNICO
-- SOLO EJECUTAR EN POSTGRES-DEV (mainline.proxy.rlwy.net)
-- PROHIBIDO EJECUTAR EN PRODUCCIÓN (sakura.proxy.rlwy.net)
-- ================================================================
-- ESTE ARCHIVO SE CREA MANUALMENTE PARA NO EJECUTAR CONEXIONES
-- AUTOMÁTICAS DE PRISMA CONTRA RAILWAY SIN APROBACIÓN EXPLÍCITA
-- ================================================================

-- ================================================================
-- PASO 1: TIPOS ENUM NUEVOS
-- ================================================================

CREATE TYPE "UsoServicioTecnico" AS ENUM (
    'SOLO_VENTA',
    'SERVICIO_TECNICO',
    'AMBOS'
);

CREATE TYPE "EstadoOrdenServicio" AS ENUM (
    'RECIBIDO',
    'DIAGNOSTICO',
    'PRESUPUESTO',
    'ESPERANDO_APROBACION',
    'APROBADO',
    'EN_REPARACION',
    'EN_PRUEBAS',
    'LISTO_PARA_ENTREGA',
    'PENDIENTE_RETIRO',
    'ENTREGADO',
    'RECHAZADO',
    'CANCELADO',
    'EN_GARANTIA'
);

CREATE TYPE "TipoItemOrdenServicio" AS ENUM (
    'REPUESTO',
    'MANO_OBRA',
    'ACCESORIO_ENTREGADO',
    'SERVICIO_ADICIONAL'
);

-- ================================================================
-- PASO 2: EXTENDER ENUM OrigenMovimientoInventario (2 valores RT)
-- ================================================================
-- Nota: en Postgres, ALTER TYPE ... ADD VALUE NO requiere Postgres 12+
-- Railway Postgres 14+ OK

ALTER TYPE "OrigenMovimientoInventario" ADD VALUE IF NOT EXISTS 'SERVICIO_TECNICO_CONSUMO';
ALTER TYPE "OrigenMovimientoInventario" ADD VALUE IF NOT EXISTS 'SERVICIO_TECNICO_DEVOLUCION';

-- ================================================================
-- PASO 3: EXTENDER TABLA productos CON CLASIFICACIÓN TÉCNICA
-- ================================================================

ALTER TABLE "productos"
    ADD COLUMN "uso_servicio_tecnico" "UsoServicioTecnico" NOT NULL DEFAULT 'SOLO_VENTA';

CREATE INDEX "productos_uso_servicio_tecnico_idx" ON "productos"("uso_servicio_tecnico");

-- ================================================================
-- PASO 4: EXTENDER TABLA movimientos_inventario
-- ================================================================
-- (FKs a OrdenServicio / OrdenItemServicio se agregan AL FINAL,
-- después de crear esas tablas.)

ALTER TABLE "movimientos_inventario"
    ADD COLUMN "orden_servicio_id" UUID NULL,
    ADD COLUMN "item_orden_servicio_id" UUID NULL;

CREATE INDEX "movimientos_inventario_orden_servicio_id_idx" ON "movimientos_inventario"("orden_servicio_id");
CREATE INDEX "movimientos_inventario_item_orden_servicio_id_idx" ON "movimientos_inventario"("item_orden_servicio_id");

-- ================================================================
-- PASO 5: CREAR 13 TABLAS NUEVAS RAYEGO TECH
-- ================================================================

-- -------------------------------------------------------------
-- 5.1 TÉCNICOS (extensión 1:1 de usuarios)
-- -------------------------------------------------------------
CREATE TABLE "tecnicos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "legajo" VARCHAR(30),
    "especialidad" VARCHAR(120),
    "telefono" VARCHAR(30),
    "email_contacto" VARCHAR(150),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    "observaciones" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tecnicos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tecnicos_usuario_id_key" ON "tecnicos"("usuario_id");
CREATE UNIQUE INDEX "tecnicos_legajo_key" ON "tecnicos"("legajo");
CREATE INDEX "tecnicos_estado_activo_idx" ON "tecnicos"("estado", "activo");
CREATE INDEX "tecnicos_deleted_at_idx" ON "tecnicos"("deleted_at");

ALTER TABLE "tecnicos"
    ADD CONSTRAINT "tecnicos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "tecnicos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "tecnicos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.2 TIPOS DE EQUIPO CLIENTE (catálogo x empresa)
-- -------------------------------------------------------------
CREATE TABLE "tipos_equipo_cliente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tipos_equipo_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_equipo_cliente_empresa_id_codigo_key" ON "tipos_equipo_cliente"("empresa_id", "codigo");
CREATE INDEX "tipos_equipo_cliente_empresa_id_activo_idx" ON "tipos_equipo_cliente"("empresa_id", "activo");
CREATE INDEX "tipos_equipo_cliente_deleted_at_idx" ON "tipos_equipo_cliente"("deleted_at");

ALTER TABLE "tipos_equipo_cliente"
    ADD CONSTRAINT "tipos_equipo_cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "tipos_equipo_cliente_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "tipos_equipo_cliente_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.3 TIPOS DE SERVICIO TÉCNICO (catálogo x empresa)
-- -------------------------------------------------------------
CREATE TABLE "tipos_servicio_tecnico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "tarifa_sugerida" DECIMAL(14,2) DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tipos_servicio_tecnico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_servicio_tecnico_empresa_id_codigo_key" ON "tipos_servicio_tecnico"("empresa_id", "codigo");
CREATE INDEX "tipos_servicio_tecnico_empresa_id_activo_idx" ON "tipos_servicio_tecnico"("empresa_id", "activo");
CREATE INDEX "tipos_servicio_tecnico_deleted_at_idx" ON "tipos_servicio_tecnico"("deleted_at");

ALTER TABLE "tipos_servicio_tecnico"
    ADD CONSTRAINT "tipos_servicio_tecnico_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "tipos_servicio_tecnico_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "tipos_servicio_tecnico_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.4 CLIENTES_EQUIPOS
-- -------------------------------------------------------------
CREATE TABLE "cliente_equipos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "tipo_equipo_id" UUID NOT NULL,
    "marca" VARCHAR(80),
    "modelo" VARCHAR(120),
    "numero_serie" VARCHAR(120),
    "accesorios" VARCHAR(500),
    "notas_internas" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "cliente_equipos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cliente_equipos_cliente_id_idx" ON "cliente_equipos"("cliente_id");
CREATE INDEX "cliente_equipos_tipo_equipo_id_idx" ON "cliente_equipos"("tipo_equipo_id");
CREATE INDEX "cliente_equipos_numero_serie_idx" ON "cliente_equipos"("numero_serie");
CREATE INDEX "cliente_equipos_empresa_id_activo_idx" ON "cliente_equipos"("empresa_id", "activo");
CREATE INDEX "cliente_equipos_deleted_at_idx" ON "cliente_equipos"("deleted_at");

ALTER TABLE "cliente_equipos"
    ADD CONSTRAINT "cliente_equipos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "cliente_equipos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "cliente_equipos_tipo_equipo_id_fkey" FOREIGN KEY ("tipo_equipo_id") REFERENCES "tipos_equipo_cliente"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "cliente_equipos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "cliente_equipos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.5 SECUENCIAS ÓRDENES SERVICIO (sucursal + año)
-- -------------------------------------------------------------
CREATE TABLE "secuencias_ordenes_servicio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sucursal_id" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "proximo_numero" INTEGER NOT NULL DEFAULT 1,
    "longitud_numero" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "secuencias_ordenes_servicio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "secuencias_ordenes_servicio_sucursal_id_anio_key"
    ON "secuencias_ordenes_servicio"("sucursal_id", "anio");

ALTER TABLE "secuencias_ordenes_servicio"
    ADD CONSTRAINT "secuencias_ordenes_servicio_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "secuencias_ordenes_servicio_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "secuencias_ordenes_servicio_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.6 ORDENES DE SERVICIO (TABLA CENTRAL RAYEGO TECH)
-- -------------------------------------------------------------
CREATE TABLE "ordenes_servicio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sucursal_id" UUID NOT NULL,
    "numero_orden" VARCHAR(50) NOT NULL,
    "cliente_id" UUID NOT NULL,
    "cliente_equipo_id" UUID NOT NULL,
    "estado_actual" "EstadoOrdenServicio" NOT NULL DEFAULT 'RECIBIDO',
    "tecnico_asignado_id" UUID,
    "fecha_recepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_entrega_estimada" DATE,
    "fecha_entrega_real" DATE,
    "problema_reportado" VARCHAR(2000) NOT NULL,
    "accesorios_recibidos" VARCHAR(500),
    "contrasena_equipo" VARCHAR(120),
    "garantia_dias_aplicados" INTEGER NOT NULL DEFAULT 30,
    "aprobado_cliente_at" TIMESTAMP(3),
    "aprobado_cliente_por_id" UUID,
    "rechazado_cliente_at" TIMESTAMP(3),
    "motivo_rechazo_cliente" VARCHAR(500),
    "subtotal_repuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal_mano_obra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal_servicios_adic" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuento_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuesto_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_orden" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_pagado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo_pendiente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones_internas" VARCHAR(1000),
    "empresa_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "ordenes_servicio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_servicio_numero_orden_key" ON "ordenes_servicio"("numero_orden");
CREATE INDEX "ordenes_servicio_sucursal_id_estado_actual_idx" ON "ordenes_servicio"("sucursal_id", "estado_actual");
CREATE INDEX "ordenes_servicio_cliente_id_idx" ON "ordenes_servicio"("cliente_id");
CREATE INDEX "ordenes_servicio_tecnico_asignado_id_idx" ON "ordenes_servicio"("tecnico_asignado_id");
CREATE INDEX "ordenes_servicio_fecha_recepcion_idx" ON "ordenes_servicio"("fecha_recepcion");
CREATE INDEX "ordenes_servicio_empresa_id_estado_actual_activo_idx" ON "ordenes_servicio"("empresa_id", "estado_actual", "activo");
CREATE INDEX "ordenes_servicio_deleted_at_idx" ON "ordenes_servicio"("deleted_at");

ALTER TABLE "ordenes_servicio"
    ADD CONSTRAINT "ordenes_servicio_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "ordenes_servicio_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "ordenes_servicio_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "ordenes_servicio_cliente_equipo_id_fkey" FOREIGN KEY ("cliente_equipo_id") REFERENCES "cliente_equipos"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "ordenes_servicio_tecnico_asignado_id_fkey" FOREIGN KEY ("tecnico_asignado_id") REFERENCES "tecnicos"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_servicio_aprobado_cliente_por_id_fkey" FOREIGN KEY ("aprobado_cliente_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_servicio_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_servicio_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.7 HISTORIAL CAMBIO DE ESTADO ÓRDENES
-- -------------------------------------------------------------
CREATE TABLE "ordenes_estado_historial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "estado" "EstadoOrdenServicio" NOT NULL,
    "observaciones" VARCHAR(500),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "realizado_por_id" UUID,

    CONSTRAINT "ordenes_estado_historial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordenes_estado_historial_orden_id_fecha_idx" ON "ordenes_estado_historial"("orden_id", "fecha");

ALTER TABLE "ordenes_estado_historial"
    ADD CONSTRAINT "ordenes_estado_historial_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_estado_historial_realizado_por_id_fkey" FOREIGN KEY ("realizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.8 DIAGNÓSTICOS ÓRDENES
-- -------------------------------------------------------------
CREATE TABLE "ordenes_diagnosticos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "tecnico_id" UUID,
    "detalle" VARCHAR(2000) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" UUID,

    CONSTRAINT "ordenes_diagnosticos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordenes_diagnosticos_orden_id_fecha_idx" ON "ordenes_diagnosticos"("orden_id", "fecha");
CREATE INDEX "ordenes_diagnosticos_tecnico_id_idx" ON "ordenes_diagnosticos"("tecnico_id");

ALTER TABLE "ordenes_diagnosticos"
    ADD CONSTRAINT "ordenes_diagnosticos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_diagnosticos_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "tecnicos"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_diagnosticos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.9 PRESUPUESTOS VERSIONADOS ÓRDENES
-- -------------------------------------------------------------
CREATE TABLE "ordenes_presupuestos_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "subtotal_repuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal_mano_obra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal_servicios_adic" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuento_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuesto_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notas_cliente" VARCHAR(1000),
    "estado_aprobacion" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    "fecha_envio_cliente" TIMESTAMP(3),
    "fecha_decision_cliente" TIMESTAMP(3),
    "motivo_rechazo" VARCHAR(500),
    "decidido_cliente_por" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" UUID,

    CONSTRAINT "ordenes_presupuestos_version_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_presupuestos_version_orden_id_version_key"
    ON "ordenes_presupuestos_version"("orden_id", "version");
CREATE INDEX "ordenes_presupuestos_version_estado_aprobacion_idx"
    ON "ordenes_presupuestos_version"("estado_aprobacion");

ALTER TABLE "ordenes_presupuestos_version"
    ADD CONSTRAINT "ordenes_presupuestos_version_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_presupuestos_version_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.10 ASIGNACIONES TÉCNICOS (historial)
-- -------------------------------------------------------------
CREATE TABLE "ordenes_asignaciones_tecnico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "tecnico_id" UUID NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_liberacion" TIMESTAMP(3),
    "motivo_cambio" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "asignado_por_id" UUID,

    CONSTRAINT "ordenes_asignaciones_tecnico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordenes_asignaciones_tecnico_orden_id_fecha_asignacion_idx"
    ON "ordenes_asignaciones_tecnico"("orden_id", "fecha_asignacion");
CREATE INDEX "ordenes_asignaciones_tecnico_tecnico_id_activo_idx"
    ON "ordenes_asignaciones_tecnico"("tecnico_id", "activo");

ALTER TABLE "ordenes_asignaciones_tecnico"
    ADD CONSTRAINT "ordenes_asignaciones_tecnico_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_asignaciones_tecnico_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "tecnicos"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "ordenes_asignaciones_tecnico_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.11 ÍTEMS ÓRDEN (repuestos / mano obra / accesorios / servicios)
-- -------------------------------------------------------------
CREATE TABLE "ordenes_items_servicio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "tipo" "TipoItemOrdenServicio" NOT NULL,
    "producto_id" UUID,
    "lote_id" UUID,
    "tipo_servicio_id" UUID,
    "tecnico_id" UUID,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_unitario_ref" DECIMAL(14,6) DEFAULT 0,
    "descuento_item" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuesto_item" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "horas_trabajadas" DECIMAL(10,2),
    "fecha_realizacion" DATE,
    "observaciones" VARCHAR(500),
    "consumido_inventario" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" UUID,
    "actualizado_por_id" UUID,

    CONSTRAINT "ordenes_items_servicio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordenes_items_servicio_orden_id_idx" ON "ordenes_items_servicio"("orden_id");
CREATE INDEX "ordenes_items_servicio_producto_id_idx" ON "ordenes_items_servicio"("producto_id");
CREATE INDEX "ordenes_items_servicio_tipo_servicio_id_idx" ON "ordenes_items_servicio"("tipo_servicio_id");
CREATE INDEX "ordenes_items_servicio_tecnico_id_idx" ON "ordenes_items_servicio"("tecnico_id");
CREATE INDEX "ordenes_items_servicio_deleted_at_idx" ON "ordenes_items_servicio"("deleted_at");

ALTER TABLE "ordenes_items_servicio"
    ADD CONSTRAINT "ordenes_items_servicio_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_items_servicio_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_items_servicio_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_items_servicio_tipo_servicio_id_fkey" FOREIGN KEY ("tipo_servicio_id") REFERENCES "tipos_servicio_tecnico"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_items_servicio_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "tecnicos"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_items_servicio_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_items_servicio_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.12 PAGOS ÓRDENES (1:N, integra con movimientos_caja)
-- -------------------------------------------------------------
CREATE TABLE "ordenes_servicio_pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "movimiento_caja_id" UUID,
    "forma_pago_id" UUID NOT NULL,
    "tipo_pago_orden" VARCHAR(30) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia_externa" VARCHAR(120),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" UUID,
    "actualizado_por_id" UUID,

    CONSTRAINT "ordenes_servicio_pagos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_servicio_pagos_movimiento_caja_id_key" ON "ordenes_servicio_pagos"("movimiento_caja_id");
CREATE INDEX "ordenes_servicio_pagos_orden_id_fecha_pago_idx" ON "ordenes_servicio_pagos"("orden_id", "fecha_pago");
CREATE INDEX "ordenes_servicio_pagos_forma_pago_id_idx" ON "ordenes_servicio_pagos"("forma_pago_id");
CREATE INDEX "ordenes_servicio_pagos_deleted_at_idx" ON "ordenes_servicio_pagos"("deleted_at");

ALTER TABLE "ordenes_servicio_pagos"
    ADD CONSTRAINT "ordenes_servicio_pagos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_servicio_pagos_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "movimientos_caja"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_servicio_pagos_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "formas_pago"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "ordenes_servicio_pagos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_servicio_pagos_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- -------------------------------------------------------------
-- 5.13 GARANTÍAS ÓRDENES (1 orden = 1 garantía max)
-- -------------------------------------------------------------
CREATE TABLE "ordenes_garantias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "dias_aplicados" INTEGER NOT NULL DEFAULT 30,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "terminos" VARCHAR(2000),
    "items_cubiertos" VARCHAR(2000),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'VIGENTE',
    "observaciones" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_por_id" UUID,
    "actualizado_por_id" UUID,

    CONSTRAINT "ordenes_garantias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_garantias_orden_id_key" ON "ordenes_garantias"("orden_id");
CREATE INDEX "ordenes_garantias_fecha_fin_estado_idx" ON "ordenes_garantias"("fecha_fin", "estado");
CREATE INDEX "ordenes_garantias_deleted_at_idx" ON "ordenes_garantias"("deleted_at");

ALTER TABLE "ordenes_garantias"
    ADD CONSTRAINT "ordenes_garantias_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ordenes_garantias_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "ordenes_garantias_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;

-- ================================================================
-- PASO 6: FKs RESTANTES movimientos_inventario → RT
-- ================================================================
-- (Aplican AL FINAL porque dependen de tablas creadas en PASO 5)

ALTER TABLE "movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_orden_servicio_id_fkey"
        FOREIGN KEY ("orden_servicio_id") REFERENCES "ordenes_servicio"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "movimientos_inventario_item_orden_servicio_id_fkey"
        FOREIGN KEY ("item_orden_servicio_id") REFERENCES "ordenes_items_servicio"("id") ON DELETE SET NULL;
