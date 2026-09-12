-- CreateEnum
CREATE TYPE "public"."tipo_linea_venta" AS ENUM ('PRODUCTO_REGISTRADO', 'VENTA_RAPIDA');

-- AlterTable
ALTER TABLE "public"."detalle_venta" ADD COLUMN     "tipo_linea" "public"."tipo_linea_venta" NOT NULL DEFAULT 'PRODUCTO_REGISTRADO';
ALTER TABLE "public"."detalle_venta" ADD COLUMN     "descripcion" VARCHAR(255);
ALTER TABLE "public"."detalle_venta" ADD COLUMN     "simbolo_unidad" VARCHAR(20);
ALTER TABLE "public"."detalle_venta" ALTER COLUMN "producto_id" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "public"."detalle_venta" DROP CONSTRAINT "detalle_venta_producto_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."detalle_venta" ADD CONSTRAINT "detalle_venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "detalle_venta_tipo_linea_idx" ON "public"."detalle_venta"("tipo_linea");
