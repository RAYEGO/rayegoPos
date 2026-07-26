ALTER TABLE "clientes"
ADD COLUMN "permitir_credito" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "clientes"
ADD COLUMN "limite_credito" DECIMAL(14,2) NOT NULL DEFAULT 0;
