CREATE EXTENSION IF NOT EXISTS "unaccent";

ALTER TABLE laboratorios
ADD COLUMN codigo VARCHAR(30);

WITH normalized AS (
  SELECT
    id,
    empresa_id,
    UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(unaccent(nombre), '[^A-Za-z0-9]+', '_', 'g'),
        '^_+|_+$',
        '',
        'g'
      )
    ) AS base_code,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id,
        UPPER(
          REGEXP_REPLACE(
            REGEXP_REPLACE(unaccent(nombre), '[^A-Za-z0-9]+', '_', 'g'),
            '^_+|_+$',
            '',
            'g'
          )
        )
      ORDER BY id
    ) AS rn
  FROM laboratorios
  WHERE codigo IS NULL
)
UPDATE laboratorios l
SET codigo = CASE
  WHEN n.rn = 1 THEN LEFT(n.base_code, 30)
  ELSE LEFT(n.base_code, GREATEST(1, 30 - (LENGTH('_' || n.rn::text)))) || '_' || n.rn::text
END
FROM normalized n
WHERE l.id = n.id;

ALTER TABLE laboratorios
ALTER COLUMN codigo SET NOT NULL;

CREATE UNIQUE INDEX laboratorios_empresa_codigo_unique
  ON laboratorios (empresa_id, codigo);


ALTER TABLE presentaciones
ADD COLUMN codigo VARCHAR(30);

WITH normalized AS (
  SELECT
    id,
    empresa_id,
    UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(unaccent(nombre), '[^A-Za-z0-9]+', '_', 'g'),
        '^_+|_+$',
        '',
        'g'
      )
    ) AS base_code,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id,
        UPPER(
          REGEXP_REPLACE(
            REGEXP_REPLACE(unaccent(nombre), '[^A-Za-z0-9]+', '_', 'g'),
            '^_+|_+$',
            '',
            'g'
          )
        )
      ORDER BY id
    ) AS rn
  FROM presentaciones
  WHERE codigo IS NULL
)
UPDATE presentaciones p
SET codigo = CASE
  WHEN n.rn = 1 THEN LEFT(n.base_code, 30)
  ELSE LEFT(n.base_code, GREATEST(1, 30 - (LENGTH('_' || n.rn::text)))) || '_' || n.rn::text
END
FROM normalized n
WHERE p.id = n.id;

ALTER TABLE presentaciones
ALTER COLUMN codigo SET NOT NULL;

CREATE UNIQUE INDEX presentaciones_empresa_codigo_unique
  ON presentaciones (empresa_id, codigo);

