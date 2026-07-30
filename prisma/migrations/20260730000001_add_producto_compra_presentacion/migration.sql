ALTER TABLE "productos"
ADD COLUMN "compra_presentacion_id" UUID;

ALTER TABLE "productos"
ADD CONSTRAINT "productos_compra_presentacion_id_fkey"
FOREIGN KEY ("compra_presentacion_id")
REFERENCES "presentaciones"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "productos_compra_presentacion_id_idx"
ON "productos"("compra_presentacion_id");
