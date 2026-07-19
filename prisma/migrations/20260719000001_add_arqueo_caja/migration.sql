-- CreateTable
CREATE TABLE "arqueo_caja" (
    "id" UUID NOT NULL,
    "apertura_caja_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_arqueo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_sistema_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monto_declarado_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "diferencia_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "arqueo_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arqueo_caja_apertura_caja_id_fecha_arqueo_idx" ON "arqueo_caja"("apertura_caja_id", "fecha_arqueo");

-- CreateIndex
CREATE INDEX "arqueo_caja_usuario_id_fecha_arqueo_idx" ON "arqueo_caja"("usuario_id", "fecha_arqueo");

-- CreateIndex
CREATE INDEX "arqueo_caja_deleted_at_idx" ON "arqueo_caja"("deleted_at");

-- AddForeignKey
ALTER TABLE "arqueo_caja" ADD CONSTRAINT "arqueo_caja_apertura_caja_id_fkey" FOREIGN KEY ("apertura_caja_id") REFERENCES "apertura_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueo_caja" ADD CONSTRAINT "arqueo_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueo_caja" ADD CONSTRAINT "arqueo_caja_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueo_caja" ADD CONSTRAINT "arqueo_caja_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

