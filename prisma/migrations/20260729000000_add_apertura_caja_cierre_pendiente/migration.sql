ALTER TABLE "public"."apertura_caja"
ADD COLUMN "cierre_pendiente" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "apertura_caja_estado_cierre_pendiente_idx"
ON "public"."apertura_caja" ("estado", "cierre_pendiente");

