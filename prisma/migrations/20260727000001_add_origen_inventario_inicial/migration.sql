DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE lower(t.typname) = lower('OrigenMovimientoInventario')
      AND e.enumlabel = 'INVENTARIO_INICIAL'
  ) THEN
    ALTER TYPE "OrigenMovimientoInventario" ADD VALUE 'INVENTARIO_INICIAL';
  END IF;
END $$;

