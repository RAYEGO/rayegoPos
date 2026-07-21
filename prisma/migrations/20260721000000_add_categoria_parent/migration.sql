-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "parent_id" UUID;

-- CreateIndex
CREATE INDEX "categorias_parent_id_idx" ON "categorias"("parent_id");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

