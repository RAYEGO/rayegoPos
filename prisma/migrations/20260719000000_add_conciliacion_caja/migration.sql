-- CreateTable
CREATE TABLE "conciliacion_caja" (
    "id" UUID NOT NULL,
    "apertura_caja_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_conciliacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_sistema_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monto_declarado_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "diferencia_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "conciliacion_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliacion_caja_detalle" (
    "id" UUID NOT NULL,
    "conciliacion_caja_id" UUID NOT NULL,
    "forma_pago_id" UUID NOT NULL,
    "monto_sistema" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monto_declarado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "diferencia" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "conciliacion_caja_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conciliacion_caja_usuario_id_fecha_conciliacion_idx" ON "conciliacion_caja"("usuario_id", "fecha_conciliacion");

-- CreateIndex
CREATE INDEX "conciliacion_caja_apertura_caja_id_fecha_conciliacion_idx" ON "conciliacion_caja"("apertura_caja_id", "fecha_conciliacion");

-- CreateIndex
CREATE INDEX "conciliacion_caja_deleted_at_idx" ON "conciliacion_caja"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "conciliacion_caja_detalle_conciliacion_caja_id_forma_pago_id_key" ON "conciliacion_caja_detalle"("conciliacion_caja_id", "forma_pago_id");

-- CreateIndex
CREATE INDEX "conciliacion_caja_detalle_forma_pago_id_idx" ON "conciliacion_caja_detalle"("forma_pago_id");

-- CreateIndex
CREATE INDEX "conciliacion_caja_detalle_deleted_at_idx" ON "conciliacion_caja_detalle"("deleted_at");

-- AddForeignKey
ALTER TABLE "conciliacion_caja" ADD CONSTRAINT "conciliacion_caja_apertura_caja_id_fkey" FOREIGN KEY ("apertura_caja_id") REFERENCES "apertura_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja" ADD CONSTRAINT "conciliacion_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja" ADD CONSTRAINT "conciliacion_caja_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja" ADD CONSTRAINT "conciliacion_caja_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja_detalle" ADD CONSTRAINT "conciliacion_caja_detalle_conciliacion_caja_id_fkey" FOREIGN KEY ("conciliacion_caja_id") REFERENCES "conciliacion_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja_detalle" ADD CONSTRAINT "conciliacion_caja_detalle_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja_detalle" ADD CONSTRAINT "conciliacion_caja_detalle_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacion_caja_detalle" ADD CONSTRAINT "conciliacion_caja_detalle_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
