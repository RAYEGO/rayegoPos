CREATE TYPE "public"."ModoOperacionEmpresa" AS ENUM ('IMPLEMENTACION', 'PRODUCCION');

ALTER TABLE "public"."empresas"
ADD COLUMN "modo_operacion" "public"."ModoOperacionEmpresa" NOT NULL DEFAULT 'IMPLEMENTACION';

CREATE INDEX "empresas_modo_operacion_idx" ON "public"."empresas" ("modo_operacion");

