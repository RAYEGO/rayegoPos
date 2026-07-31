CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "public"."tipos_medicamento" (
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
  CONSTRAINT "tipos_medicamento_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_medicamento_empresa_id_fkey'
  ) THEN
    ALTER TABLE "public"."tipos_medicamento"
      ADD CONSTRAINT "tipos_medicamento_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_medicamento_created_by_fkey'
  ) THEN
    ALTER TABLE "public"."tipos_medicamento"
      ADD CONSTRAINT "tipos_medicamento_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipos_medicamento_updated_by_fkey'
  ) THEN
    ALTER TABLE "public"."tipos_medicamento"
      ADD CONSTRAINT "tipos_medicamento_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tipos_medicamento_empresa_id_codigo_key"
  ON "public"."tipos_medicamento"("empresa_id", "codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_medicamento_empresa_id_nombre_key"
  ON "public"."tipos_medicamento"("empresa_id", "nombre");
CREATE INDEX IF NOT EXISTS "tipos_medicamento_empresa_id_idx"
  ON "public"."tipos_medicamento"("empresa_id");
CREATE INDEX IF NOT EXISTS "tipos_medicamento_deleted_at_idx"
  ON "public"."tipos_medicamento"("deleted_at");

ALTER TABLE "public"."productos"
  ADD COLUMN IF NOT EXISTS "tipo_medicamento_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_tipo_medicamento_id_fkey'
  ) THEN
    ALTER TABLE "public"."productos"
      ADD CONSTRAINT "productos_tipo_medicamento_id_fkey"
      FOREIGN KEY ("tipo_medicamento_id") REFERENCES "public"."tipos_medicamento"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "productos_tipo_medicamento_id_idx"
  ON "public"."productos"("tipo_medicamento_id");

INSERT INTO "public"."tipos_medicamento" (
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
    ('TIPO_GENERICO', 'Genérico', 'Medicamento comercializado como genérico.'),
    ('TIPO_MARCA', 'Marca', 'Medicamento comercializado bajo marca.'),
    ('TIPO_SIMILAR', 'Similar', 'Medicamento clasificado como similar.')
) AS seed("codigo", "nombre", "descripcion")
WHERE e."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."tipos_medicamento" tm
    WHERE tm."empresa_id" = e."id"
      AND tm."deleted_at" IS NULL
      AND LOWER(tm."nombre") = LOWER(seed."nombre")
  )
ON CONFLICT DO NOTHING;
