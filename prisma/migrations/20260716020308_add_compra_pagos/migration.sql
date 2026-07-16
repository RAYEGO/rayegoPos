-- CreateTable
CREATE TABLE "public"."compra_pagos" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "forma_pago_id" UUID NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia_externa" VARCHAR(120),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "compra_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compra_pagos_compra_id_fecha_pago_idx" ON "public"."compra_pagos"("compra_id", "fecha_pago");

-- CreateIndex
CREATE INDEX "compra_pagos_forma_pago_id_idx" ON "public"."compra_pagos"("forma_pago_id");

-- CreateIndex
CREATE INDEX "compra_pagos_deleted_at_idx" ON "public"."compra_pagos"("deleted_at");

-- AddForeignKey
ALTER TABLE "public"."compra_pagos" ADD CONSTRAINT "compra_pagos_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_pagos" ADD CONSTRAINT "compra_pagos_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "public"."formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_pagos" ADD CONSTRAINT "compra_pagos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_pagos" ADD CONSTRAINT "compra_pagos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
