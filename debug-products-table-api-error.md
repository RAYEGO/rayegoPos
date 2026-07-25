[OPEN] products table api error

## Síntoma
- En la tabla de Productos aparece: "Ocurrió un error inesperado en la API."

## Alcance
- Endpoint sospechoso: GET /api/products

## Hipótesis (falsables)
1) El SQL de `$queryRaw` (lowStockCount o sort por stockUnits) está fallando por sintaxis/parametrización.
2) El SQL referencia columnas/tablas que no existen en el schema real desplegado (migración incompleta o nombres distintos).
3) Algún query param llega inválido (uuid malformado, sortBy no permitido, page/pageSize fuera de rango) y provoca error en runtime.
4) Error de conexión/timeout a DB al ejecutar los agregados (count + joins) bajo carga.

## Evidencia a recolectar
- Logs del backend para una llamada a GET /api/products con query completo.
- Stacktrace/código de error (especialmente Prisma error code) si existe.

## Resultado esperado
- GET /api/products responde 200 con `items`, `summary`, `pagination`, `sort`.

## Estado
- Próximo paso: instrumentar logs en la ruta y reproducir.

