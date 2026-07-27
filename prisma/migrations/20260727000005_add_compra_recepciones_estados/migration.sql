-- CreateEnum
CREATE TYPE "public"."EstadoCompraLogistico" AS ENUM (
  'REGISTRADA',
  'EN_RECEPCION',
  'RECEPCION_PARCIAL',
  'RECEPCION_COMPLETA',
  'CANCELADA'
);

-- CreateEnum
CREATE TYPE "public"."EstadoCompraFinanciero" AS ENUM (
  'SIN_PAGAR',
  'PAGO_PARCIAL',
  'PAGADA'
);

-- AlterTable
ALTER TABLE "public"."compras"
ADD COLUMN "estado_logistico" "public"."EstadoCompraLogistico" NOT NULL DEFAULT 'REGISTRADA',
ADD COLUMN "estado_financiero" "public"."EstadoCompraFinanciero" NOT NULL DEFAULT 'SIN_PAGAR';

-- Backfill logistics state based on legacy estado
UPDATE "public"."compras"
SET "estado_logistico" = CASE
  WHEN "estado" = 'ANULADA' THEN 'CANCELADA'::"public"."EstadoCompraLogistico"
  WHEN "estado" = 'PAGADA' THEN 'RECEPCION_COMPLETA'::"public"."EstadoCompraLogistico"
  WHEN "estado" = 'PARCIAL' THEN 'RECEPCION_PARCIAL'::"public"."EstadoCompraLogistico"
  ELSE 'REGISTRADA'::"public"."EstadoCompraLogistico"
END;

-- Backfill financial state based on saldo_pendiente
UPDATE "public"."compras"
SET "estado_financiero" = CASE
  WHEN COALESCE("saldo_pendiente", 0) <= 0 THEN 'PAGADA'::"public"."EstadoCompraFinanciero"
  WHEN COALESCE("saldo_pendiente", 0) < COALESCE("total", 0) THEN 'PAGO_PARCIAL'::"public"."EstadoCompraFinanciero"
  ELSE 'SIN_PAGAR'::"public"."EstadoCompraFinanciero"
END;

-- CreateTable
CREATE TABLE "public"."compra_recepciones" (
  "id" UUID NOT NULL,
  "compra_id" UUID NOT NULL,
  "numero" INTEGER NOT NULL,
  "fecha_recepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observaciones" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  CONSTRAINT "compra_recepciones_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."lotes"
ADD COLUMN "compra_recepcion_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "compra_recepciones_compra_id_numero_key"
ON "public"."compra_recepciones"("compra_id", "numero");

-- CreateIndex
CREATE INDEX "compra_recepciones_compra_id_fecha_recepcion_idx"
ON "public"."compra_recepciones"("compra_id", "fecha_recepcion");

-- CreateIndex
CREATE INDEX "compra_recepciones_deleted_at_idx"
ON "public"."compra_recepciones"("deleted_at");

-- CreateIndex
CREATE INDEX "lotes_compra_recepcion_id_idx"
ON "public"."lotes"("compra_recepcion_id");

-- AddForeignKey
ALTER TABLE "public"."compra_recepciones"
ADD CONSTRAINT "compra_recepciones_compra_id_fkey"
FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_recepciones"
ADD CONSTRAINT "compra_recepciones_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_recepciones"
ADD CONSTRAINT "compra_recepciones_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes"
ADD CONSTRAINT "lotes_compra_recepcion_id_fkey"
FOREIGN KEY ("compra_recepcion_id") REFERENCES "public"."compra_recepciones"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

