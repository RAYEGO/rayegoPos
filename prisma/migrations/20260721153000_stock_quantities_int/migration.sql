DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM inventario
    WHERE stock_minimo IS NOT NULL
      AND stock_minimo <> trunc(stock_minimo)
  ) THEN
    RAISE EXCEPTION 'inventario.stock_minimo contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM inventario
    WHERE stock_maximo IS NOT NULL
      AND stock_maximo <> trunc(stock_maximo)
  ) THEN
    RAISE EXCEPTION 'inventario.stock_maximo contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM inventario
    WHERE punto_reorden IS NOT NULL
      AND punto_reorden <> trunc(punto_reorden)
  ) THEN
    RAISE EXCEPTION 'inventario.punto_reorden contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lotes
    WHERE stock_inicial <> trunc(stock_inicial)
      OR stock_disponible <> trunc(stock_disponible)
      OR stock_reservado <> trunc(stock_reservado)
      OR stock_bloqueado <> trunc(stock_bloqueado)
  ) THEN
    RAISE EXCEPTION 'lotes contiene valores decimales en columnas de stock. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM movimientos_inventario
    WHERE cantidad <> trunc(cantidad)
  ) THEN
    RAISE EXCEPTION 'movimientos_inventario.cantidad contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM movimientos_inventario
    WHERE stock_resultante IS NOT NULL
      AND stock_resultante <> trunc(stock_resultante)
  ) THEN
    RAISE EXCEPTION 'movimientos_inventario.stock_resultante contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM detalle_compra
    WHERE cantidad <> trunc(cantidad)
  ) THEN
    RAISE EXCEPTION 'detalle_compra.cantidad contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM detalle_venta
    WHERE cantidad <> trunc(cantidad)
  ) THEN
    RAISE EXCEPTION 'detalle_venta.cantidad contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM detalle_venta_lote
    WHERE cantidad <> trunc(cantidad)
  ) THEN
    RAISE EXCEPTION 'detalle_venta_lote.cantidad contiene valores decimales. Normaliza antes de migrar a integer.';
  END IF;
END $$;

ALTER TABLE inventario
  ALTER COLUMN stock_minimo TYPE integer USING stock_minimo::integer,
  ALTER COLUMN stock_maximo TYPE integer USING stock_maximo::integer,
  ALTER COLUMN punto_reorden TYPE integer USING punto_reorden::integer;

ALTER TABLE lotes
  ALTER COLUMN stock_inicial TYPE integer USING stock_inicial::integer,
  ALTER COLUMN stock_disponible TYPE integer USING stock_disponible::integer,
  ALTER COLUMN stock_reservado TYPE integer USING stock_reservado::integer,
  ALTER COLUMN stock_bloqueado TYPE integer USING stock_bloqueado::integer;

ALTER TABLE movimientos_inventario
  ALTER COLUMN cantidad TYPE integer USING cantidad::integer,
  ALTER COLUMN stock_resultante TYPE integer USING stock_resultante::integer;

ALTER TABLE detalle_compra
  ALTER COLUMN cantidad TYPE integer USING cantidad::integer;

ALTER TABLE detalle_venta
  ALTER COLUMN cantidad TYPE integer USING cantidad::integer;

ALTER TABLE detalle_venta_lote
  ALTER COLUMN cantidad TYPE integer USING cantidad::integer;

