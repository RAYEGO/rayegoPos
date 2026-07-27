[OPEN] Debugging: purchase payment partial error

## Síntoma
- En pagos parciales desde Compras, el frontend muestra: "Ocurrió un error inesperado en la API."

## Objetivo
- Obtener evidencia runtime: status code, mensaje real, stack trace completo y clasificación (validación / Prisma / DB / regla de negocio / no controlada).
- Corregir la causa raíz.
- En desarrollo, devolver el mensaje real (y stack si aplica) para diagnóstico.

## Hipótesis (falsables)
1) Prisma lanza una excepción (P20xx u otra) durante la transacción y no se envuelve con `statusCode`, causando 500 genérico.
2) El lock `SELECT ... FOR UPDATE` o alguna consulta agregada está fallando (tabla/columna inexistente, permisos, SQL inválido), generando error no controlado.
3) Hay un caso de datos `null/undefined` (por ejemplo `purchase.proveedor`) que dispara un TypeError al construir observaciones o cálculos.
4) El error ocurre en el handler global y se pierde el detalle (se devuelve 500 genérico aunque el error tenga mensaje útil).
5) La request llega con payload inválido pero no pasa por Zod en route (o hay mismatch de schema), generando error inesperado.

## Evidencia requerida
- Log NDJSON del error con: requestId, endpoint, statusCode calculado, error.name, error.message, stack, prisma.code/meta si existiera.

## Estado
- Instrumentación pendiente y reproducción pendiente.

