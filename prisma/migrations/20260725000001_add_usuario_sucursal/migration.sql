-- CreateTable
CREATE TABLE "public"."usuario_sucursal" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "usuario_sucursal_pkey" PRIMARY KEY ("id")
);

-- Enable UUID generation helper (Supabase: pgcrypto is available in most projects).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateIndex
CREATE UNIQUE INDEX "usuario_sucursal_usuario_id_sucursal_id_key" ON "public"."usuario_sucursal"("usuario_id", "sucursal_id");

-- CreateIndex
CREATE INDEX "usuario_sucursal_sucursal_id_activo_idx" ON "public"."usuario_sucursal"("sucursal_id", "activo");

-- CreateIndex
CREATE INDEX "usuario_sucursal_rol_id_idx" ON "public"."usuario_sucursal"("rol_id");

-- CreateIndex
CREATE INDEX "usuario_sucursal_deleted_at_idx" ON "public"."usuario_sucursal"("deleted_at");

-- AddForeignKey
ALTER TABLE "public"."usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration (best-effort): if a user has a single assigned sucursal_id and at least one active role, create the membership.
INSERT INTO "public"."usuario_sucursal" ("id", "usuario_id", "sucursal_id", "rol_id", "activo", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  u.id,
  u.sucursal_id,
  (
    SELECT ur.rol_id
    FROM "public"."usuario_rol" ur
    WHERE ur.usuario_id = u.id
      AND ur.activo = true
      AND ur.deleted_at IS NULL
    ORDER BY ur.created_at ASC
    LIMIT 1
  ) AS rol_id,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."usuarios" u
WHERE u.sucursal_id IS NOT NULL
  AND u.deleted_at IS NULL
  AND (
    SELECT ur.rol_id
    FROM "public"."usuario_rol" ur
    WHERE ur.usuario_id = u.id
      AND ur.activo = true
      AND ur.deleted_at IS NULL
    ORDER BY ur.created_at ASC
    LIMIT 1
  ) IS NOT NULL
ON CONFLICT ("usuario_id", "sucursal_id") DO NOTHING;
