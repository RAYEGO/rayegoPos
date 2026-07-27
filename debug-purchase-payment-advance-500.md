[OPEN] Debug session: purchase-payment-advance-500

## Síntoma
- Al registrar un pago parcial (ej. S/ 100) desde una Orden de Compra (ej. adelanto), la UI muestra: "Ocurrió un error inesperado en la API."
- Con pagos por el monto total se muestra correctamente el aviso de faltante de caja (409) cuando aplica.
- Con Yape se pudo registrar pago en un escenario, pero con adelanto vuelve a fallar (pendiente confirmar condiciones exactas).

## Alcance
- Endpoint: POST /api/purchases/payments
- Módulos: Compras ↔ Caja

## Hipótesis (falsables)
1) El backend está lanzando una excepción no controlada (500) dentro de la transacción al crear `movimientoCaja`/`egresoCaja` (relaciones/FK, campos requeridos, constraint).
2) El error proviene de una validación/parseo (monto/fecha/UUID) que no se está retornando con status code y mensaje correctos.
3) La validación de saldo está calculando `availableCash` incorrectamente para EFECTIVO vs no-EFECTIVO y termina en una rama inesperada (ej. NaN/Decimal).
4) Prisma devuelve un error (P2002/P2003/etc.) y se está envolviendo en un error genérico sin propagar el mensaje real al cliente.
5) El frontend está ocultando el mensaje real porque la API responde sin JSON esperado (ej. error handler devuelve HTML o body vacío).

## Evidencia requerida
- Status code real de la respuesta.
- Body devuelto por el backend (message/stack en dev).
- Stack trace completo (server).
- Parámetros del request (compraId, formaPagoId, monto, fechaPago).

## Plan
1) Levantar Debug Server y habilitar telemetría para capturar eventos y stack.
2) Instrumentar POST /api/purchases/payments (start/success/error) y el handler de errores.
3) Reproducir el caso “adelanto S/100”.
4) Analizar logs y aplicar fix mínimo basado en evidencia.

