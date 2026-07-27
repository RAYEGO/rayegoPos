-- Multiempresa (base): scoped masters por empresa.
-- Estrategia v1: tablas operativas derivan empresa vía sucursal; maestros y entidades compartidas se anclan a Empresa.

-- =========================================
-- Usuarios
-- =========================================
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "usuarios" u
SET "empresa_id" = s."empresa_id"
FROM "sucursales" s
WHERE u."empresa_id" IS NULL
  AND u."sucursal_id" IS NOT NULL
  AND s."id" = u."sucursal_id";

UPDATE "usuarios"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "usuarios" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_empresa_id_fkey";
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- =========================================
-- Categorías
-- =========================================
ALTER TABLE "categorias" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "categorias"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "categorias" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "categorias" DROP CONSTRAINT IF EXISTS "categorias_empresa_id_fkey";
ALTER TABLE "categorias"
  ADD CONSTRAINT "categorias_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categorias" DROP CONSTRAINT IF EXISTS "categorias_codigo_key";
ALTER TABLE "categorias" DROP CONSTRAINT IF EXISTS "categorias_nombre_key";
ALTER TABLE "categorias"
  ADD CONSTRAINT "categorias_empresa_id_codigo_key" UNIQUE ("empresa_id", "codigo");
ALTER TABLE "categorias"
  ADD CONSTRAINT "categorias_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");

CREATE INDEX IF NOT EXISTS "categorias_empresa_id_idx" ON "categorias"("empresa_id");

-- =========================================
-- Laboratorios
-- =========================================
ALTER TABLE "laboratorios" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "laboratorios"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "laboratorios" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "laboratorios" DROP CONSTRAINT IF EXISTS "laboratorios_empresa_id_fkey";
ALTER TABLE "laboratorios"
  ADD CONSTRAINT "laboratorios_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "laboratorios" DROP CONSTRAINT IF EXISTS "laboratorios_nombre_key";
ALTER TABLE "laboratorios"
  ADD CONSTRAINT "laboratorios_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");

CREATE INDEX IF NOT EXISTS "laboratorios_empresa_id_idx" ON "laboratorios"("empresa_id");

-- =========================================
-- Presentaciones
-- =========================================
ALTER TABLE "presentaciones" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "presentaciones"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "presentaciones" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "presentaciones" DROP CONSTRAINT IF EXISTS "presentaciones_empresa_id_fkey";
ALTER TABLE "presentaciones"
  ADD CONSTRAINT "presentaciones_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "presentaciones" DROP CONSTRAINT IF EXISTS "presentaciones_nombre_key";
ALTER TABLE "presentaciones"
  ADD CONSTRAINT "presentaciones_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");

CREATE INDEX IF NOT EXISTS "presentaciones_empresa_id_idx" ON "presentaciones"("empresa_id");

-- =========================================
-- Unidades de medida
-- =========================================
ALTER TABLE "unidades_medida" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "unidades_medida"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "unidades_medida" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "unidades_medida" DROP CONSTRAINT IF EXISTS "unidades_medida_empresa_id_fkey";
ALTER TABLE "unidades_medida"
  ADD CONSTRAINT "unidades_medida_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unidades_medida" DROP CONSTRAINT IF EXISTS "unidades_medida_codigo_key";
ALTER TABLE "unidades_medida" DROP CONSTRAINT IF EXISTS "unidades_medida_nombre_key";
ALTER TABLE "unidades_medida" DROP CONSTRAINT IF EXISTS "unidades_medida_simbolo_key";
ALTER TABLE "unidades_medida"
  ADD CONSTRAINT "unidades_medida_empresa_id_codigo_key" UNIQUE ("empresa_id", "codigo");
ALTER TABLE "unidades_medida"
  ADD CONSTRAINT "unidades_medida_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");
ALTER TABLE "unidades_medida"
  ADD CONSTRAINT "unidades_medida_empresa_id_simbolo_key" UNIQUE ("empresa_id", "simbolo");

CREATE INDEX IF NOT EXISTS "unidades_medida_empresa_id_idx" ON "unidades_medida"("empresa_id");

-- =========================================
-- Principios activos
-- =========================================
ALTER TABLE "principios_activos" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "principios_activos"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "principios_activos" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "principios_activos" DROP CONSTRAINT IF EXISTS "principios_activos_empresa_id_fkey";
ALTER TABLE "principios_activos"
  ADD CONSTRAINT "principios_activos_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principios_activos" DROP CONSTRAINT IF EXISTS "principios_activos_nombre_key";
ALTER TABLE "principios_activos"
  ADD CONSTRAINT "principios_activos_empresa_id_nombre_key" UNIQUE ("empresa_id", "nombre");

CREATE INDEX IF NOT EXISTS "principios_activos_empresa_id_idx" ON "principios_activos"("empresa_id");

-- =========================================
-- Productos
-- =========================================
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "productos"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "productos" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "productos_empresa_id_fkey";
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "productos_sku_key";
ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "productos_codigo_interno_key";
ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "productos_codigo_barras_key";
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_empresa_id_sku_key" UNIQUE ("empresa_id", "sku");
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_empresa_id_codigo_interno_key" UNIQUE ("empresa_id", "codigo_interno");
ALTER TABLE "productos"
  ADD CONSTRAINT "productos_empresa_id_codigo_barras_key" UNIQUE ("empresa_id", "codigo_barras");

CREATE INDEX IF NOT EXISTS "productos_empresa_id_idx" ON "productos"("empresa_id");

-- =========================================
-- Proveedores
-- =========================================
ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "proveedores"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "proveedores" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "proveedores" DROP CONSTRAINT IF EXISTS "proveedores_empresa_id_fkey";
ALTER TABLE "proveedores"
  ADD CONSTRAINT "proveedores_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proveedores" DROP CONSTRAINT IF EXISTS "proveedores_numero_documento_key";
ALTER TABLE "proveedores"
  ADD CONSTRAINT "proveedores_empresa_id_numero_documento_key" UNIQUE ("empresa_id", "numero_documento");

CREATE INDEX IF NOT EXISTS "proveedores_empresa_id_idx" ON "proveedores"("empresa_id");

-- =========================================
-- Clientes
-- =========================================
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "empresa_id" UUID;

UPDATE "clientes"
SET "empresa_id" = (SELECT "id" FROM "empresas" LIMIT 1)
WHERE "empresa_id" IS NULL;

ALTER TABLE "clientes" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "clientes_empresa_id_fkey";
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "clientes_numero_documento_key";
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_empresa_id_numero_documento_key" UNIQUE ("empresa_id", "numero_documento");

CREATE INDEX IF NOT EXISTS "clientes_empresa_id_idx" ON "clientes"("empresa_id");

