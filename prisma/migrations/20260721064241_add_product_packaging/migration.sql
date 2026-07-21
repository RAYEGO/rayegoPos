-- CreateEnum
CREATE TYPE "public"."ModoEmpaqueProducto" AS ENUM ('SIMPLE', 'BLISTER');

-- CreateEnum
CREATE TYPE "public"."EmpaqueProducto" AS ENUM ('UNIDAD', 'BLISTER', 'CAJA');

-- AlterTable
ALTER TABLE "public"."detalle_compra" ADD COLUMN     "cantidad_empaque" INTEGER,
ADD COLUMN     "empaque" "public"."EmpaqueProducto",
ADD COLUMN     "factor_empaque" INTEGER;

-- AlterTable
ALTER TABLE "public"."detalle_venta" ADD COLUMN     "cantidad_empaque" INTEGER,
ADD COLUMN     "empaque" "public"."EmpaqueProducto",
ADD COLUMN     "factor_empaque" INTEGER;

-- AlterTable
ALTER TABLE "public"."productos" ADD COLUMN     "blisters_por_caja" INTEGER,
ADD COLUMN     "modo_empaque" "public"."ModoEmpaqueProducto" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN     "precio_venta_blister" DECIMAL(14,2),
ADD COLUMN     "unidades_por_blister" INTEGER;

-- RenameIndex
ALTER INDEX "public"."conciliacion_caja_detalle_conciliacion_caja_id_forma_pago_id_ke" RENAME TO "conciliacion_caja_detalle_conciliacion_caja_id_forma_pago_i_key";
