-- Add new master-data fields for Categoría
ALTER TABLE "categorias"
ADD COLUMN "codigo" VARCHAR(30),
ADD COLUMN "color" VARCHAR(20),
ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "nombre") - 1 AS "orden"
  FROM "categorias"
  WHERE "deleted_at" IS NULL
)
UPDATE "categorias" AS c
SET "orden" = o."orden"
FROM ordered AS o
WHERE c."id" = o."id";

UPDATE "categorias"
SET "codigo" = UPPER(REGEXP_REPLACE("nombre", '[^a-zA-Z0-9]+', '_', 'g'))
WHERE "codigo" IS NULL;

WITH ranked AS (
  SELECT
    "id",
    "codigo",
    ROW_NUMBER() OVER (PARTITION BY "codigo" ORDER BY "created_at", "id") AS rn
  FROM "categorias"
)
UPDATE "categorias" AS c
SET "codigo" = LEFT(r."codigo" || '_' || r.rn::text, 30)
FROM ranked AS r
WHERE c."id" = r."id"
  AND r.rn > 1;

ALTER TABLE "categorias"
ALTER COLUMN "codigo" SET NOT NULL;

CREATE UNIQUE INDEX "categorias_codigo_key" ON "categorias"("codigo");
