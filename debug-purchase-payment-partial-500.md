[OPEN] Debugging: purchase payment partial 500 (railway)

## Síntoma
- Registrar un pago parcial (monto menor al saldo pendiente) desde Compras devuelve 500 con mensaje genérico en producción.

## Objetivo
- Identificar la excepción real: mensaje, stack trace, archivo y línea.
- Determinar exactamente qué operación falla dentro de la transacción:
  - creación del pago (`compraPago`)
  - actualización de compra (`compra`)
  - creación del movimiento de caja (`movimientoCaja`)
  - creación del egreso (`egreso`)

## Hipótesis (falsables)
1) Falla al crear el movimiento de caja o egreso por constraint/relación (FK/NOT NULL) cuando el pago es parcial.
2) Falla al actualizar `compra.saldoPendiente` o `compra.estadoFinanciero` por validación/constraint no evidente (trigger/constraint en DB o mismatch de datos).
3) Falla al crear `compraPago` por constraint (por ejemplo índice/unique en producción) o por datos requeridos según forma de pago.
4) La excepción es Prisma (P20xx) y se está perdiendo el detalle porque `NODE_ENV=production`.
5) La excepción es un TypeError por null/undefined al construir observaciones (p.ej. `purchase.proveedor`), que solo ocurre en cierto dataset.

## Evidencia requerida
- HTTP status code y response body con `message` + `stack` + `requestId` (modo debug).
- Alternativa: logs de Railway del request 500 (stack trace).

## Estado
- Instrumentación pendiente (exponer error real bajo flag controlado + marcar paso fallido).

