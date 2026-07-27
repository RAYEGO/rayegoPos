CREATE TYPE "EstadoCargaInventarioInicial" AS ENUM ('COMPLETADA', 'FALLIDA', 'ANULADA');

CREATE TABLE "cargas_inventario_inicial" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sucursal_id" UUID NOT NULL,
  "estado" "EstadoCargaInventarioInicial" NOT NULL DEFAULT 'COMPLETADA',
  "productos_cargados" INTEGER NOT NULL DEFAULT 0,
  "lotes_creados" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  CONSTRAINT "cargas_inventario_inicial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cargas_inventario_inicial_detalle" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "carga_id" UUID NOT NULL,
  "sucursal_id" UUID NOT NULL,
  "producto_id" UUID NOT NULL,
  "lote_id" UUID NOT NULL,
  "numero_lote" VARCHAR(80) NOT NULL,
  "fecha_vencimiento" DATE NOT NULL,
  "costo_unitario" DECIMAL(14,6) NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  CONSTRAINT "cargas_inventario_inicial_detalle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cargas_inventario_inicial_sucursal_id_created_at_idx" ON "cargas_inventario_inicial"("sucursal_id", "created_at");
CREATE INDEX "cargas_inventario_inicial_estado_idx" ON "cargas_inventario_inicial"("estado");
CREATE INDEX "cargas_inventario_inicial_deleted_at_idx" ON "cargas_inventario_inicial"("deleted_at");

CREATE INDEX "cargas_inventario_inicial_detalle_carga_id_idx" ON "cargas_inventario_inicial_detalle"("carga_id");
CREATE INDEX "cargas_inventario_inicial_detalle_sucursal_id_producto_id_idx" ON "cargas_inventario_inicial_detalle"("sucursal_id", "producto_id");
CREATE INDEX "cargas_inventario_inicial_detalle_deleted_at_idx" ON "cargas_inventario_inicial_detalle"("deleted_at");

ALTER TABLE "cargas_inventario_inicial"
ADD CONSTRAINT "cargas_inventario_inicial_sucursal_id_fkey"
FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial"
ADD CONSTRAINT "cargas_inventario_inicial_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial"
ADD CONSTRAINT "cargas_inventario_inicial_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial_detalle"
ADD CONSTRAINT "cargas_inventario_inicial_detalle_carga_id_fkey"
FOREIGN KEY ("carga_id") REFERENCES "cargas_inventario_inicial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial_detalle"
ADD CONSTRAINT "cargas_inventario_inicial_detalle_sucursal_id_fkey"
FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial_detalle"
ADD CONSTRAINT "cargas_inventario_inicial_detalle_producto_id_fkey"
FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial_detalle"
ADD CONSTRAINT "cargas_inventario_inicial_detalle_lote_id_fkey"
FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial_detalle"
ADD CONSTRAINT "cargas_inventario_inicial_detalle_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cargas_inventario_inicial_detalle"
ADD CONSTRAINT "cargas_inventario_inicial_detalle_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

