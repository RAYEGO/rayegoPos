ALTER TABLE "empresas"
ADD COLUMN "logo_url" VARCHAR(500);

ALTER TABLE "empresas"
ADD COLUMN "igv_por_defecto" DECIMAL(7, 4) NOT NULL DEFAULT 18;

