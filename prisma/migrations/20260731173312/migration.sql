/*
  Warnings:

  - You are about to drop the column `tipo_medicamento_id` on the `productos` table. All the data in the column will be lost.
  - You are about to drop the `tipos_medicamento` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `codigo` on table `principios_activos` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "productos" DROP CONSTRAINT "productos_tipo_medicamento_id_fkey";

-- DropForeignKey
ALTER TABLE "tipos_medicamento" DROP CONSTRAINT "tipos_medicamento_created_by_fkey";

-- DropForeignKey
ALTER TABLE "tipos_medicamento" DROP CONSTRAINT "tipos_medicamento_empresa_id_fkey";

-- DropForeignKey
ALTER TABLE "tipos_medicamento" DROP CONSTRAINT "tipos_medicamento_updated_by_fkey";

-- DropIndex
DROP INDEX "principios_activos_empresa_id_codigo_key";

-- DropIndex
DROP INDEX "productos_tipo_medicamento_id_idx";

-- AlterTable
ALTER TABLE "principios_activos" ALTER COLUMN "codigo" SET NOT NULL;

-- AlterTable
ALTER TABLE "productos" DROP COLUMN "tipo_medicamento_id";

-- AlterTable
ALTER TABLE "tipos_comerciales" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "tipos_medicamento";
