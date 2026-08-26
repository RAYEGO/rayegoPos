-- ============================================================
-- RAYEGO POS · Multinegocio
-- Migración: TipoEmpresa, Modulo, TipoEmpresaModulo + FK Empresa.tipoEmpresaId
-- Fecha: 2026-08-25
-- Objetivo: arquitectura multinegocio manteniendo V1 Botica intacta.
-- ============================================================

-- ============================================================
-- 1. TABLAS NUEVAS
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."tipos_empresa" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "icono" VARCHAR(50),
    "color" VARCHAR(20),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tipos_empresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tipos_empresa_codigo_key" ON "public"."tipos_empresa"("codigo");
CREATE INDEX IF NOT EXISTS "tipos_empresa_activo_idx" ON "public"."tipos_empresa"("activo");
CREATE INDEX IF NOT EXISTS "tipos_empresa_orden_idx" ON "public"."tipos_empresa"("orden");
CREATE INDEX IF NOT EXISTS "tipos_empresa_deleted_at_idx" ON "public"."tipos_empresa"("deleted_at");

CREATE TABLE IF NOT EXISTS "public"."modulos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "icono" VARCHAR(50),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "categoria" VARCHAR(50),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "modulos_codigo_key" ON "public"."modulos"("codigo");
CREATE INDEX IF NOT EXISTS "modulos_activo_idx" ON "public"."modulos"("activo");
CREATE INDEX IF NOT EXISTS "modulos_orden_idx" ON "public"."modulos"("orden");
CREATE INDEX IF NOT EXISTS "modulos_categoria_idx" ON "public"."modulos"("categoria");
CREATE INDEX IF NOT EXISTS "modulos_deleted_at_idx" ON "public"."modulos"("deleted_at");

CREATE TABLE IF NOT EXISTS "public"."tipo_empresa_modulo" (
    "id" UUID NOT NULL,
    "tipo_empresa_id" UUID NOT NULL,
    "modulo_codigo" VARCHAR(50) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_empresa_modulo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tipo_empresa_modulo_tipo_empresa_id_modulo_codigo_key"
  ON "public"."tipo_empresa_modulo"("tipo_empresa_id", "modulo_codigo");
CREATE INDEX IF NOT EXISTS "tipo_empresa_modulo_modulo_codigo_idx"
  ON "public"."tipo_empresa_modulo"("modulo_codigo");

ALTER TABLE "public"."tipo_empresa_modulo"
  ADD CONSTRAINT "tipo_empresa_modulo_tipo_empresa_id_fkey"
  FOREIGN KEY ("tipo_empresa_id") REFERENCES "public"."tipos_empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."tipo_empresa_modulo"
  ADD CONSTRAINT "tipo_empresa_modulo_modulo_codigo_fkey"
  FOREIGN KEY ("modulo_codigo") REFERENCES "public"."modulos"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."tipos_empresa"
  ADD CONSTRAINT "tipos_empresa_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."tipos_empresa"
  ADD CONSTRAINT "tipos_empresa_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."modulos"
  ADD CONSTRAINT "modulos_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."modulos"
  ADD CONSTRAINT "modulos_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2. EMPRESA: Añadir columna tipo_empresa_id
-- ============================================================

ALTER TABLE "public"."empresas"
  ADD COLUMN IF NOT EXISTS "tipo_empresa_id" UUID;

CREATE INDEX IF NOT EXISTS "empresas_tipo_empresa_id_idx"
  ON "public"."empresas"("tipo_empresa_id");

-- ============================================================
-- 3. SEED: Tipos de empresa iniciales
-- ============================================================

INSERT INTO "public"."tipos_empresa" ("id", "codigo", "nombre", "descripcion", "icono", "color", "orden", "activo")
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'BOTICA',
    'Botica / Farmacia',
    'Negocio dedicado a la dispensación de medicamentos y productos de salud.',
    'Pill',
    '#2563eb',
    1,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'SERVICIO_TECNICO',
    'Servicio Técnico',
    'Negocio dedicado a reparación, mantenimiento y atención técnica de equipos.',
    'Wrench',
    '#16a34a',
    2,
    true
  )
ON CONFLICT ("codigo") DO NOTHING;

-- ============================================================
-- 4. SEED: Catálogo de módulos global (BOTICA + SERVICIO_TECNICO)
-- ============================================================

INSERT INTO "public"."modulos" ("id", "codigo", "nombre", "descripcion", "icono", "orden", "categoria", "activo")
VALUES
  ('10000000-0000-0000-0000-000000000001', 'dashboard',        'Dashboard',         'Panel principal con métricas y KPIs.',                    'LayoutDashboard', 10,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000002', 'ventas',           'Ventas',            'Registro y cobro de ventas mostrador.',                    'ShoppingCart',  20,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000003', 'compras',          'Compras',           'Órdenes de compra y recepciones a proveedores.',           'Truck',         30,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000004', 'productos',        'Productos',         'Catálogo maestro de productos y servicios.',               'Package',       40,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000005', 'inventario',       'Inventario',        'Saldos de stock y movimientos de inventario.',             'Boxes',         50,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000006', 'lotes',            'Lotes',             'Gestión de lotes, vencimientos y trazabilidad.',           'ClipboardList', 55,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000007', 'kardex',           'Kardex',            'Kardex valorizado de productos farmacéuticos.',            'BookOpen',      57,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000008', 'clientes',         'Clientes',          'Registro de clientes y estado de cuenta.',                 'Users',         60,  'GESTION',      true),
  ('10000000-0000-0000-0000-000000000009', 'proveedores',      'Proveedores',       'Registro de proveedores y condiciones comerciales.',       'Store',         70,  'GESTION',      true),
  ('10000000-0000-0000-0000-000000000010', 'caja',             'Caja',              'Apertura, cierre, movimientos y conciliación de caja.',    'CreditCard',    80,  'OPERATIVO',    true),
  ('10000000-0000-0000-0000-000000000011', 'usuarios',         'Usuarios',          'Gestión de usuarios, roles y asignaciones.',               'ClipboardList', 90,  'GESTION',      true),
  ('10000000-0000-0000-0000-000000000012', 'sesiones',         'Sesiones',          'Administración de sesiones activas y revocación.',         'Monitor',       92,  'GESTION',      true),
  ('10000000-0000-0000-0000-000000000013', 'auditoria',        'Auditoría',         'Historial de acciones y cambios del sistema.',             'FileSearch',    94,  'GESTION',      true),
  ('10000000-0000-0000-0000-000000000014', 'reportes',         'Reportes',          'Reportes operativos, financieros y gerenciales.',          'BarChart3',     100, 'GESTION',      true),
  ('10000000-0000-0000-0000-000000000015', 'configuracion',    'Configuración',     'Parámetros operativos, sucursales y empresa.',             'Settings',      110, 'CONFIGURACION',true),
  -- Nuevos SERVICIO_TECNICO
  ('10000000-0000-0000-0000-000000000101', 'equipos',            'Equipos',              'Registro de equipos y dispositivos de clientes.',               'Server',        41, 'OPERATIVO',   true),
  ('10000000-0000-0000-0000-000000000102', 'ordenes_servicio',    'Órdenes de servicio',   'Flujo de órdenes de servicio / tickets.',                      'Ticket',        42, 'OPERATIVO',   true),
  ('10000000-0000-0000-0000-000000000103', 'diagnostico',        'Diagnóstico',          'Registro de diagnósticos técnicos por equipo.',                'Stethoscope',   43, 'OPERATIVO',   true),
  ('10000000-0000-0000-0000-000000000104', 'presupuestos',       'Presupuestos',         'Presupuestos aprobados por cliente / orden servicio.',        'FileText',      44, 'OPERATIVO',   true),
  ('10000000-0000-0000-0000-000000000105', 'reparaciones',       'Reparaciones',         'Progreso y detalle de reparaciones en curso.',                'Hammer',        45, 'OPERATIVO',   true),
  ('10000000-0000-0000-0000-000000000106', 'entregas',           'Entregas',             'Entrega de equipos reparados al cliente.',                    'PackageCheck',  46, 'OPERATIVO',   true)
ON CONFLICT ("codigo") DO NOTHING;

-- ============================================================
-- 5. SEED: TipoEmpresaModulo — BOTICA habilita los módulos tradicionales
-- ============================================================

INSERT INTO "public"."tipo_empresa_modulo" ("id", "tipo_empresa_id", "modulo_codigo", "orden", "activo")
SELECT
  gen_random_uuid(),
  te.id,
  m.codigo,
  m.orden,
  true
FROM "public"."tipos_empresa" te
CROSS JOIN "public"."modulos" m
WHERE te.codigo = 'BOTICA'
  AND m.codigo IN (
    'dashboard','ventas','compras','productos','inventario','lotes','kardex',
    'clientes','proveedores','caja','usuarios','sesiones','auditoria',
    'reportes','configuracion'
  )
ON CONFLICT ("tipo_empresa_id", "modulo_codigo") DO NOTHING;

-- ============================================================
-- 6. SEED: TipoEmpresaModulo — SERVICIO_TECNICO
-- ============================================================

INSERT INTO "public"."tipo_empresa_modulo" ("id", "tipo_empresa_id", "modulo_codigo", "orden", "activo")
SELECT
  gen_random_uuid(),
  te.id,
  m.codigo,
  m.orden,
  true
FROM "public"."tipos_empresa" te
CROSS JOIN "public"."modulos" m
WHERE te.codigo = 'SERVICIO_TECNICO'
  AND m.codigo IN (
    'dashboard','clientes','equipos','ordenes_servicio','diagnostico',
    'presupuestos','reparaciones','entregas','caja','usuarios','sesiones',
    'auditoria','reportes','configuracion'
  )
ON CONFLICT ("tipo_empresa_id", "modulo_codigo") DO NOTHING;

-- ============================================================
-- 7. Empresas existentes → asignar TIPO = BOTICA por defecto
-- ============================================================

UPDATE "public"."empresas" emp
SET "tipo_empresa_id" = (
  SELECT te.id FROM "public"."tipos_empresa" te WHERE te.codigo = 'BOTICA' LIMIT 1
)
WHERE emp."tipo_empresa_id" IS NULL;

-- Ahora que todas tienen valor, volvemos la columna NOT NULL y añadimos FK.

ALTER TABLE "public"."empresas"
  ALTER COLUMN "tipo_empresa_id" SET NOT NULL;

ALTER TABLE "public"."empresas"
  DROP CONSTRAINT IF EXISTS "empresas_tipo_empresa_id_fkey";

ALTER TABLE "public"."empresas"
  ADD CONSTRAINT "empresas_tipo_empresa_id_fkey"
  FOREIGN KEY ("tipo_empresa_id") REFERENCES "public"."tipos_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
