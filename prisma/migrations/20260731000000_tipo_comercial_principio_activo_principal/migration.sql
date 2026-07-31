CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "public"."tipos_comerciales" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id" UUID NOT NULL,
  "codigo" VARCHAR(30) NOT NULL,
  "nombre" VARCHAR(120) NOT NULL,
  "descripcion" VARCHAR(255),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  CONSTRAINT "tipos_comerciales_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_comerciales_empresa_id_fkey'
  ) THEN
    ALTER TABLE "public"."tipos_comerciales"
      ADD CONSTRAINT "tipos_comerciales_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_comerciales_created_by_fkey'
  ) THEN
    ALTER TABLE "public"."tipos_comerciales"
      ADD CONSTRAINT "tipos_comerciales_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_comerciales_updated_by_fkey'
  ) THEN
    ALTER TABLE "public"."tipos_comerciales"
      ADD CONSTRAINT "tipos_comerciales_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tipos_comerciales_empresa_id_codigo_key"
  ON "public"."tipos_comerciales"("empresa_id", "codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_comerciales_empresa_id_nombre_key"
  ON "public"."tipos_comerciales"("empresa_id", "nombre");
CREATE INDEX IF NOT EXISTS "tipos_comerciales_empresa_id_idx"
  ON "public"."tipos_comerciales"("empresa_id");
CREATE INDEX IF NOT EXISTS "tipos_comerciales_deleted_at_idx"
  ON "public"."tipos_comerciales"("deleted_at");

ALTER TABLE "public"."principios_activos"
  ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(30);

ALTER TABLE "public"."productos"
  ADD COLUMN IF NOT EXISTS "tipo_comercial_id" UUID,
  ADD COLUMN IF NOT EXISTS "principio_activo_id" UUID;

INSERT INTO "public"."tipos_comerciales" (
  "empresa_id",
  "codigo",
  "nombre",
  "descripcion",
  "activo",
  "created_at",
  "updated_at"
)
SELECT
  e."id",
  seed."codigo",
  seed."nombre",
  seed."descripcion",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."empresas" e
CROSS JOIN (
  VALUES
    ('TIPO_COMERCIAL_GENERICO', 'Genérico', 'Producto comercializado como genérico.'),
    ('TIPO_COMERCIAL_MARCA', 'Marca', 'Producto comercializado bajo una marca comercial.')
) AS seed("codigo", "nombre", "descripcion")
WHERE e."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."tipos_comerciales" tc
    WHERE tc."empresa_id" = e."id"
      AND tc."deleted_at" IS NULL
      AND LOWER(tc."nombre") = LOWER(seed."nombre")
  )
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tipos_medicamento'
  ) THEN
    INSERT INTO "public"."tipos_comerciales" (
      "empresa_id",
      "codigo",
      "nombre",
      "descripcion",
      "activo",
      "created_at",
      "updated_at",
      "deleted_at",
      "created_by",
      "updated_by"
    )
    SELECT
      tm."empresa_id",
      tm."codigo",
      tm."nombre",
      tm."descripcion",
      tm."activo",
      tm."created_at",
      tm."updated_at",
      tm."deleted_at",
      tm."created_by",
      tm."updated_by"
    FROM "public"."tipos_medicamento" tm
    WHERE NOT EXISTS (
      SELECT 1
      FROM "public"."tipos_comerciales" tc
      WHERE tc."empresa_id" = tm."empresa_id"
        AND LOWER(tc."nombre") = LOWER(tm."nombre")
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'productos'
      AND column_name = 'tipo_medicamento_id'
  ) THEN
    UPDATE "public"."productos" p
    SET "tipo_comercial_id" = tc."id"
    FROM "public"."tipos_medicamento" tm
    JOIN "public"."tipos_comerciales" tc
      ON tc."empresa_id" = tm."empresa_id"
     AND LOWER(tc."nombre") = LOWER(tm."nombre")
    WHERE p."tipo_comercial_id" IS NULL
      AND p."tipo_medicamento_id" = tm."id";
  END IF;
END $$;

UPDATE "public"."principios_activos" pa
SET "codigo" = LEFT(REGEXP_REPLACE(UPPER(pa."nombre"), '[^A-Z0-9]+', '_', 'g'), 30)
WHERE pa."codigo" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "principios_activos_empresa_id_codigo_key"
  ON "public"."principios_activos"("empresa_id", "codigo");

UPDATE "public"."productos" p
SET "principio_activo_id" = source."principio_activo_id"
FROM (
  SELECT DISTINCT ON (ppa."producto_id")
    ppa."producto_id",
    ppa."principio_activo_id"
  FROM "public"."producto_principio_activo" ppa
  WHERE ppa."deleted_at" IS NULL
  ORDER BY ppa."producto_id", ppa."created_at" ASC, ppa."id" ASC
) AS source
WHERE p."id" = source."producto_id"
  AND p."principio_activo_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_tipo_comercial_id_fkey'
  ) THEN
    ALTER TABLE "public"."productos"
      ADD CONSTRAINT "productos_tipo_comercial_id_fkey"
      FOREIGN KEY ("tipo_comercial_id") REFERENCES "public"."tipos_comerciales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_principio_activo_id_fkey'
  ) THEN
    ALTER TABLE "public"."productos"
      ADD CONSTRAINT "productos_principio_activo_id_fkey"
      FOREIGN KEY ("principio_activo_id") REFERENCES "public"."principios_activos"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "productos_tipo_comercial_id_idx"
  ON "public"."productos"("tipo_comercial_id");
CREATE INDEX IF NOT EXISTS "productos_principio_activo_id_idx"
  ON "public"."productos"("principio_activo_id");
