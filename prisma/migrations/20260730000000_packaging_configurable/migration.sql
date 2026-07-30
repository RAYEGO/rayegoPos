CREATE TABLE "producto_presentaciones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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

CREATE TABLE "producto_conversiones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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

ALTER TABLE "detalle_compra"
ADD COLUMN "presentacion_id" UUID,
ADD COLUMN "cantidad_presentacion" INTEGER,
ADD COLUMN "factor_presentacion" INTEGER;

ALTER TABLE "detalle_venta"
ADD COLUMN "presentacion_id" UUID,
ADD COLUMN "cantidad_presentacion" INTEGER,
ADD COLUMN "factor_presentacion" INTEGER;

ALTER TABLE "producto_presentaciones"
ADD CONSTRAINT "producto_presentaciones_producto_id_fkey"
FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "producto_presentaciones"
ADD CONSTRAINT "producto_presentaciones_presentacion_id_fkey"
FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "producto_conversiones"
ADD CONSTRAINT "producto_conversiones_producto_id_fkey"
FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "producto_conversiones"
ADD CONSTRAINT "producto_conversiones_desde_presentacion_id_fkey"
FOREIGN KEY ("desde_presentacion_id") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "producto_conversiones"
ADD CONSTRAINT "producto_conversiones_hacia_presentacion_id_fkey"
FOREIGN KEY ("hacia_presentacion_id") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "detalle_compra"
ADD CONSTRAINT "detalle_compra_presentacion_id_fkey"
FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "detalle_venta"
ADD CONSTRAINT "detalle_venta_presentacion_id_fkey"
FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "producto_presentaciones_producto_id_presentacion_id_key"
ON "producto_presentaciones"("producto_id", "presentacion_id");

CREATE INDEX "producto_presentaciones_presentacion_id_idx" ON "producto_presentaciones"("presentacion_id");
CREATE INDEX "producto_presentaciones_producto_id_es_base_idx" ON "producto_presentaciones"("producto_id", "es_base");
CREATE INDEX "producto_presentaciones_deleted_at_idx" ON "producto_presentaciones"("deleted_at");

CREATE UNIQUE INDEX "producto_conversiones_producto_id_desde_presentacion_id_hacia_presentacion_id_key"
ON "producto_conversiones"("producto_id", "desde_presentacion_id", "hacia_presentacion_id");

CREATE INDEX "producto_conversiones_desde_presentacion_id_idx" ON "producto_conversiones"("desde_presentacion_id");
CREATE INDEX "producto_conversiones_hacia_presentacion_id_idx" ON "producto_conversiones"("hacia_presentacion_id");
CREATE INDEX "producto_conversiones_deleted_at_idx" ON "producto_conversiones"("deleted_at");

INSERT INTO "presentaciones" ("empresa_id", "codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT
  e.id,
  'PRE-UNI',
  'Unidad',
  'Presentación base preconfigurada para conversión.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "empresas" e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "presentaciones" p
    WHERE p.empresa_id = e.id
      AND p.deleted_at IS NULL
      AND LOWER(p.nombre) = 'unidad'
  );

INSERT INTO "presentaciones" ("empresa_id", "codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT
  e.id,
  'PRE-BLI',
  'Blíster',
  'Presentación preconfigurada para conversión.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "empresas" e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "presentaciones" p
    WHERE p.empresa_id = e.id
      AND p.deleted_at IS NULL
      AND (LOWER(p.nombre) = 'blíster' OR LOWER(p.nombre) = 'blister')
  );

INSERT INTO "presentaciones" ("empresa_id", "codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
SELECT
  e.id,
  'PRE-CAJ',
  'Caja',
  'Presentación preconfigurada para conversión.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "empresas" e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "presentaciones" p
    WHERE p.empresa_id = e.id
      AND p.deleted_at IS NULL
      AND LOWER(p.nombre) = 'caja'
  );

INSERT INTO "producto_presentaciones" (
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
  p.id,
  pres_unidad.id,
  true,
  true,
  true,
  p.precio_venta,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'unidad'
  LIMIT 1
) pres_unidad ON true
WHERE p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "producto_presentaciones" (
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
  p.id,
  pres_blister.id,
  false,
  true,
  true,
  COALESCE(p.precio_venta_blister, p.precio_venta * p.unidades_por_blister),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND (LOWER(pr.nombre) = 'blíster' OR LOWER(pr.nombre) = 'blister')
  LIMIT 1
) pres_blister ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
ON CONFLICT DO NOTHING;

INSERT INTO "producto_presentaciones" (
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
  p.id,
  pres_caja.id,
  false,
  true,
  false,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'caja'
  LIMIT 1
) pres_caja ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
ON CONFLICT DO NOTHING;

INSERT INTO "producto_conversiones" (
  "producto_id",
  "desde_presentacion_id",
  "hacia_presentacion_id",
  "cantidad",
  "created_at",
  "updated_at"
)
SELECT
  p.id,
  pres_blister.id,
  pres_unidad.id,
  p.unidades_por_blister,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'unidad'
  LIMIT 1
) pres_unidad ON true
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND (LOWER(pr.nombre) = 'blíster' OR LOWER(pr.nombre) = 'blister')
  LIMIT 1
) pres_blister ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
  AND p.unidades_por_blister IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "producto_conversiones" (
  "producto_id",
  "desde_presentacion_id",
  "hacia_presentacion_id",
  "cantidad",
  "created_at",
  "updated_at"
)
SELECT
  p.id,
  pres_caja.id,
  pres_blister.id,
  p.blisters_por_caja,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "productos" p
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND (LOWER(pr.nombre) = 'blíster' OR LOWER(pr.nombre) = 'blister')
  LIMIT 1
) pres_blister ON true
JOIN LATERAL (
  SELECT pr.id
  FROM "presentaciones" pr
  WHERE pr.empresa_id = p.empresa_id
    AND pr.deleted_at IS NULL
    AND LOWER(pr.nombre) = 'caja'
  LIMIT 1
) pres_caja ON true
WHERE p.deleted_at IS NULL
  AND p.modo_empaque = 'BLISTER'
  AND p.blisters_por_caja IS NOT NULL
ON CONFLICT DO NOTHING;
