CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "public"."producto_presentaciones" (
  "id" UUID NOT NULL,
  "producto_id" UUID NOT NULL,
  "presentacion_id" UUID NOT NULL,
  "es_base" BOOLEAN NOT NULL DEFAULT false,
  "permite_compra" BOOLEAN NOT NULL DEFAULT false,
  "permite_venta" BOOLEAN NOT NULL DEFAULT false,
  "precio_venta" DECIMAL(14,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  CONSTRAINT "producto_presentaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."producto_conversiones" (
  "id" UUID NOT NULL,
  "producto_id" UUID NOT NULL,
  "desde_presentacion_id" UUID NOT NULL,
  "hacia_presentacion_id" UUID NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  CONSTRAINT "producto_conversiones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."detalle_compra" ADD COLUMN IF NOT EXISTS "presentacion_id" UUID;
ALTER TABLE "public"."detalle_compra" ADD COLUMN IF NOT EXISTS "cantidad_presentacion" INTEGER;
ALTER TABLE "public"."detalle_compra" ADD COLUMN IF NOT EXISTS "factor_presentacion" INTEGER;

ALTER TABLE "public"."detalle_venta" ADD COLUMN IF NOT EXISTS "presentacion_id" UUID;
ALTER TABLE "public"."detalle_venta" ADD COLUMN IF NOT EXISTS "cantidad_presentacion" INTEGER;
ALTER TABLE "public"."detalle_venta" ADD COLUMN IF NOT EXISTS "factor_presentacion" INTEGER;

ALTER TABLE "public"."productos" ADD COLUMN IF NOT EXISTS "compra_presentacion_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productos_compra_presentacion_id_fkey'
  ) THEN
    ALTER TABLE "public"."productos"
      ADD CONSTRAINT "productos_compra_presentacion_id_fkey"
      FOREIGN KEY ("compra_presentacion_id") REFERENCES "public"."presentaciones"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "productos_compra_presentacion_id_idx"
  ON "public"."productos"("compra_presentacion_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_presentaciones_producto_id_fkey') THEN
    ALTER TABLE "public"."producto_presentaciones"
      ADD CONSTRAINT "producto_presentaciones_producto_id_fkey"
      FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_presentaciones_presentacion_id_fkey') THEN
    ALTER TABLE "public"."producto_presentaciones"
      ADD CONSTRAINT "producto_presentaciones_presentacion_id_fkey"
      FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_conversiones_producto_id_fkey') THEN
    ALTER TABLE "public"."producto_conversiones"
      ADD CONSTRAINT "producto_conversiones_producto_id_fkey"
      FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_conversiones_desde_presentacion_id_fkey') THEN
    ALTER TABLE "public"."producto_conversiones"
      ADD CONSTRAINT "producto_conversiones_desde_presentacion_id_fkey"
      FOREIGN KEY ("desde_presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_conversiones_hacia_presentacion_id_fkey') THEN
    ALTER TABLE "public"."producto_conversiones"
      ADD CONSTRAINT "producto_conversiones_hacia_presentacion_id_fkey"
      FOREIGN KEY ("hacia_presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'detalle_compra_presentacion_id_fkey') THEN
    ALTER TABLE "public"."detalle_compra"
      ADD CONSTRAINT "detalle_compra_presentacion_id_fkey"
      FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'detalle_venta_presentacion_id_fkey') THEN
    ALTER TABLE "public"."detalle_venta"
      ADD CONSTRAINT "detalle_venta_presentacion_id_fkey"
      FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "producto_presentaciones_producto_id_presentacion_id_key"
  ON "public"."producto_presentaciones"("producto_id", "presentacion_id");
CREATE INDEX IF NOT EXISTS "producto_presentaciones_presentacion_id_idx"
  ON "public"."producto_presentaciones"("presentacion_id");
CREATE INDEX IF NOT EXISTS "producto_presentaciones_producto_id_es_base_idx"
  ON "public"."producto_presentaciones"("producto_id", "es_base");
CREATE INDEX IF NOT EXISTS "producto_presentaciones_deleted_at_idx"
  ON "public"."producto_presentaciones"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "producto_conversiones_producto_id_desde_presentacion_id_hacia_presentacion_id_key"
  ON "public"."producto_conversiones"("producto_id", "desde_presentacion_id", "hacia_presentacion_id");
CREATE INDEX IF NOT EXISTS "producto_conversiones_desde_presentacion_id_idx"
  ON "public"."producto_conversiones"("desde_presentacion_id");
CREATE INDEX IF NOT EXISTS "producto_conversiones_hacia_presentacion_id_idx"
  ON "public"."producto_conversiones"("hacia_presentacion_id");
CREATE INDEX IF NOT EXISTS "producto_conversiones_deleted_at_idx"
  ON "public"."producto_conversiones"("deleted_at");

INSERT INTO "public"."presentaciones" ("id", "empresa_id", "codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  e.id,
  'PRE-UNI',
  'Unidad',
  'Presentación base preconfigurada para conversión.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."empresas" e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."presentaciones" p
    WHERE p.empresa_id = e.id
      AND p.deleted_at IS NULL
      AND LOWER(p.nombre) = 'unidad'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "public"."presentaciones" ("id", "empresa_id", "codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  e.id,
  'PRE-BLI',
  'Blíster',
  'Presentación preconfigurada para conversión.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."empresas" e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."presentaciones" p
    WHERE p.empresa_id = e.id
      AND p.deleted_at IS NULL
      AND (LOWER(p.nombre) = 'blíster' OR LOWER(p.nombre) = 'blister')
  )
ON CONFLICT DO NOTHING;

INSERT INTO "public"."presentaciones" ("id", "empresa_id", "codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  e.id,
  'PRE-CAJ',
  'Caja',
  'Presentación preconfigurada para conversión.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."empresas" e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."presentaciones" p
    WHERE p.empresa_id = e.id
      AND p.deleted_at IS NULL
      AND LOWER(p.nombre) = 'caja'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "public"."producto_presentaciones" (
  "id",
  "producto_id",
  "presentacion_id",
  "es_base",
  "permite_compra",
  "permite_venta",
  "precio_venta",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p.id,
  pres_unidad.id,
  true,
  true,
  true,
  p.precio_venta,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'unidad'
  LIMIT 1
) pres_unidad ON true
WHERE p.deleted_at IS NULL
ON CONFLICT ("producto_id", "presentacion_id") DO NOTHING;

INSERT INTO "public"."producto_presentaciones" (
  "id",
  "producto_id",
  "presentacion_id",
  "es_base",
  "permite_compra",
  "permite_venta",
  "precio_venta",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p.id,
  pres_blister.id,
  false,
  true,
  true,
  COALESCE(p.precio_venta_blister, p.precio_venta * p.unidades_por_blister),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND (LOWER(pr.nombre) = 'blíster' OR LOWER(pr.nombre) = 'blister')
  LIMIT 1
) pres_blister ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
ON CONFLICT ("producto_id", "presentacion_id") DO NOTHING;

INSERT INTO "public"."producto_presentaciones" (
  "id",
  "producto_id",
  "presentacion_id",
  "es_base",
  "permite_compra",
  "permite_venta",
  "precio_venta",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p.id,
  pres_caja.id,
  false,
  true,
  false,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'caja'
  LIMIT 1
) pres_caja ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
ON CONFLICT ("producto_id", "presentacion_id") DO NOTHING;

INSERT INTO "public"."producto_conversiones" (
  "id",
  "producto_id",
  "desde_presentacion_id",
  "hacia_presentacion_id",
  "cantidad",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p.id,
  pres_blister.id,
  pres_unidad.id,
  p.unidades_por_blister,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'unidad'
  LIMIT 1
) pres_unidad ON true
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND (LOWER(pr.nombre) = 'blíster' OR LOWER(pr.nombre) = 'blister')
  LIMIT 1
) pres_blister ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
  AND p.unidades_por_blister IS NOT NULL
ON CONFLICT ("producto_id", "desde_presentacion_id", "hacia_presentacion_id") DO NOTHING;

INSERT INTO "public"."producto_conversiones" (
  "id",
  "producto_id",
  "desde_presentacion_id",
  "hacia_presentacion_id",
  "cantidad",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p.id,
  pres_caja.id,
  pres_blister.id,
  p.blisters_por_caja,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND (LOWER(pr.nombre) = 'blíster' OR LOWER(pr.nombre) = 'blister')
  LIMIT 1
) pres_blister ON true
JOIN LATERAL (
  SELECT pr.id
  FROM "public"."presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'caja'
  LIMIT 1
) pres_caja ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
  AND p.blisters_por_caja IS NOT NULL
ON CONFLICT ("producto_id", "desde_presentacion_id", "hacia_presentacion_id") DO NOTHING;

UPDATE "public"."productos" p
SET "compra_presentacion_id" = candidates.presentacion_id
FROM (
  SELECT
    p2.id AS producto_id,
    (
      SELECT pp.presentacion_id
      FROM "public"."producto_presentaciones" pp
      JOIN "public"."presentaciones" pres ON pres.id = pp.presentacion_id
      WHERE pp.producto_id = p2.id
        AND pp.deleted_at IS NULL
        AND pres.deleted_at IS NULL
        AND pp.permite_compra = true
      ORDER BY
        CASE
          WHEN LOWER(pres.nombre) = 'caja' THEN 0
          WHEN LOWER(pres.nombre) = 'blíster' OR LOWER(pres.nombre) = 'blister' THEN 1
          WHEN LOWER(pres.nombre) = 'unidad' THEN 2
          ELSE 3
        END
      LIMIT 1
    ) AS presentacion_id
  FROM "public"."productos" p2
  WHERE p2.deleted_at IS NULL
    AND p2.compra_presentacion_id IS NULL
) candidates
WHERE candidates.producto_id = p.id
  AND candidates.presentacion_id IS NOT NULL;
