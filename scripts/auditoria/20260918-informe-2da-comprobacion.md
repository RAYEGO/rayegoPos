# INFORME FINAL — SEGUNDA COMPROBACIÓN: AUDITORÍA PROFUNDA DE OPERACIONES REALES POR PERMISO

*Fecha auditoría: 2026-09-18 | Alcance: Rayego POS completo (backend + frontend) | Modo: solo lectura, sin modificaciones*

---

## A. PERMISOS .MANAGE — OPERACIONES REALES POR CADA UNO

### A.1 Tabla 7 permisos .manage (formato user)

| Permiso | Operación concreta | Backend endpoint / archivo (Línea clave) | Frontend acción / pantalla | Restricciones adicionales | Estado |
|---|---|---|---|---|---|
| **ventas.manage** | Crear venta (producto registrado) | `POST /api/sales` [sales.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/sales/sales.service.ts#L1150-L1230) | Nueva Venta (Punto de Venta) | `requireBranchAuthContext` (empresa/sucursal por JWT). Precio producto **no editable en payload** (se lee de BD). | ✅ protegido |
| **ventas.manage** | Venta rápida (producto no registrado, precio libre) | `POST /api/sales` schema VENTA_RÁPIDA zod L31 routes/sales | Botón "Venta rápida" | `precioUnitario: z.number().positive()` SIN límite superior. Cualquier usuario con ventas.manage envía precio arbitrario. | ⚠️ sin límite de precio |
| **ventas.manage** | Modificar carrito / aplicar descuento (línea y total) | `POST /api/sales` payload `discountTotal`, items[x].`discountTotal` | Sección Descuentos en POS | **Backend solo valida**: `discountTotal >= 0 && discountTotal < grossAmount`. **SIN límite por rol**. 100% de descuento permitido a cualquiera. | ⚠️ SIN límite de descuento por rol |
| **ventas.manage** | Venta a crédito / múltiples pagos parciales | `POST /api/sales` pagos array; si `totalPagado < total` → `saldoPendiente > 0` | Checkbox "Crédito" + pagos múltiples en POS | Requiere al menos 1 pago (si es efectivo requiere caja abierta). No valida cliente crédito habilitado en esta capa. | ✅ OK |
| **ventas.manage** | Anular venta (cancel) | `PATCH /api/sales/:id/cancel` [sales.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/sales/sales.service.ts#L1750-L1830) | Botón "Anular" (historial ventas) | Actualiza estado → ANULADA. Sin restricción extra. | ✅ protegido |
| **caja.manage** | Abrir caja (apertura operativa) | `POST /api/cashier/open` [cashier.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/cashier/cashier.service.ts#L586-L660) | Botón "Abrir caja" | requirePermission(caja.manage) + apertura por usuario propio en sucursal. Primer "fallback create caja estructural" requireCanAdminCajasEstructuralmente. | ✅ OK doble guard |
| **caja.manage** | Cerrar caja DEFINITIVAMENTE | `POST /api/cashier/close` [cashier.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/cashier/cashier.service.ts#L697-L740) | Botón "Cerrar caja" | 👉 **CON CONDICIÓN ADICIONAL**: `requirePermission('caja.manage')` + **`requireCanCloseCashDrawer()`** (verticales: BOTICA → ADMIN_BOTICA/SUPERVISOR; ST → ADMIN_SERVICIO_TECNICO). ❌ CAJERO/TÉCNICO bloqueados. | ✅ cierre con regla vertical |
| **caja.manage** | Registrar movimiento ingreso/egreso manual | `POST /api/cashier/movement` [cashier.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/cashier/cashier.service.ts#L904-L1021) | Botón "Ingreso" / "Egreso" en panel caja | requirePermission(caja.manage) + caja ABIERTA usuario actual. | ✅ protegido |
| **caja.read** | Ver arqueo previo (dashboard + conciliación preview) | `GET /cashier/reconciliation/preview` L1103 + `GET /cash-counts` L1395 | Panel Arqueo / "Conteo efectivo" | caja.read + ownership (solo usuario que abrió). | ✅ OK |
| **NO DETERMINADO / SIN GUARD** | **Guardar conciliación (saveCashReconciliation)** | `POST /cashier/reconciliation` [cashier.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/cashier/cashier.service.ts#L1224-L1319) | Botón "Guardar conciliación" | **FALTA requirePermission()**. Solo: (a) ownership usuario apertura === userId JWT, (b) caja ABIERTA. Cualquier usuario autenticado que sea dueño pero sin caja.manage tecnicamente podría. | 🚨 SIN permiso backend |
| **NO DETERMINADO / SIN GUARD** | **Registrar arqueo de caja (createCashCount)** | `POST /cashier/cash-count` [cashier.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/cashier/cashier.service.ts#L1331-L1392) | Botón "Registrar conteo" | **FALTA requirePermission()**. Solo ownership + caja abierta. Mismo fallo que saveCashReconciliation. | 🚨 SIN permiso backend |
| **productos.manage** | CRUD producto (crear/editar/eliminar/activar) | `POST/PUT/DELETE /api/products/:id` [products.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/products/products.service.ts) | Formulario "Nuevo producto" | Todos los endpoints requirePermission(productos.manage). | ✅ OK |
| **productos.manage** | Modificar precio, presentación, unidad, categoría, laboratorio, principio activo, tipo comercial | 6 maestros × 3 CUD = 18 endpoints `/categories`, `/laboratories`, `/presentations`, `/units`, `/commercialTypes`, `/activePrinciples` routes/products.ts | Menú "Catálogos" dentro Productos | **TODOS 18 endpoints comparten productos.manage** → agrupación excesiva. No hay granularidad "editar precio solo". | ⚠️ AGRUPADO excesivo |
| **productos.manage** | Stock inicial (insert/update campo `stockInicial`) | Crear producto L2355 actualiza inventario | Formulario "Inventario inicial" | Depende de productos.manage; mezcla catálogo con inventario inicial. (Operaciones de LOTE son inventario.manage separado.) | ⚠️ Mezclado catalogo/inventario inicial |
| **compras.manage** | Crear / editar orden de compra | `POST /api/purchases/orders`, `PUT /purchases/orders/:id` | Nueva Compra | requirePermission(compras.manage). | ✅ |
| **compras.manage** | **RECEPCIÓN FÍSICA de mercadería (2 endpoints)** 👉 CRÍTICO | `POST /purchases/receipts/:id` receivePurchaseItem L2922 + `POST /purchases/receptions` createPurchaseReception L2986 [purchases.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/purchases/purchases.service.ts) | Botón "Recibir mercadería" y "Confirmar recepción total" | **SÍ está 100% protegido por compras.manage**. Esto es problema funcional: según matriz, ALMACÉN debe poder RECEPCIONAR pero NO CREAR COMPRAS/PAGAR; pero ambos comparten el mismo permiso. | 🚨 AGRUPACIÓN CRÍTICA (ADMIN vs ALMACÉN) |
| **compras.manage** | Registrar pago a proveedor | `POST /api/purchases/payments` registerPurchasePayment L2162 | Botón "Pagar proveedor" | **TAMBIÉN compras.manage**. Requiere caja abierta si efectivo. Pago proveedor + recepción + crear compra = Mismo permiso. | ⚠️ agrupado 3 dominios |
| **compras.manage** | Devolución compra item | `POST /purchases/returns` returnPurchaseItem | "Devolver item" | compras.manage también. | ⚠️ agrupado |
| **inventario.manage** | Crear lote (con stock) | `POST /inventory/lots` [inventory.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/inventory/inventory.service.ts) | Nueva lote | requirePermission(inventario.manage). | ✅ OK |
| **inventario.manage** | Ajustar stock (entrada/salida manual) | `POST /inventory/lots/adjust` adjustInventoryLot L1119 | Ajustar stock | inventario.manage. | ✅ OK |
| **inventario.manage** | Transferir lote entre sucursales | `POST /inventory/lots/transfer` transferInventoryLot L67 | Transferencia | inventario.manage. | ✅ OK |
| **inventario.manage** | FIFO / costeo | — | — | **NO hay implementación FIFO en código inspeccionado**. | ❌ NO implementado |
| **NO DETERMINADO** | Eliminar / anular movimiento inventario | — routes inventory | — | No existe endpoint delete/anular movimiento inventario. | NO DETERMINADO |
| **clientes.read** | Ver listado, detalle, historial ventas, estado de cuenta | GET `/customers/:id/sales`, GET `/customers/:id/account-statement` | Panel Clientes + Detalle | clientes.read. | ✅ OK |
| **clientes.manage** | Editar cliente (incl. activar/desactivar, límite crédito, permitir crédito, datos financieros) | `PUT /api/customers/:id` updateCustomer [customers.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/customers/customers.service.ts#L307-L398) | Botón "Guardar cambios" cliente | ÚNICA operación correctamente protegida con clientes.manage. | ✅ protegido |
| **🚨 SIN GUARD** | **CREAR cliente (incl. límite crédito)** | `POST /api/customers` createCustomer [customers.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/customers/customers.service.ts#L252-L305) | Botón "Nuevo cliente" | **FALTA COMPLETAMENTE requirePermission('clientes.manage')**. Solo requiereBranchAuthContext. Cualquier usuario autenticado en sucursal puede crear, incluso cargar límite de crédito. | 🚨 AGUJERO seguridad |
| **🚨 SIN GUARD** | **ELIMINAR cliente (soft delete)** | `DELETE /api/customers/:id` deleteCustomer [customers.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/customers/customers.service.ts#L400-L421) | Menú "Eliminar" cliente | **SIN requirePermission**. Solo branch auth. | 🚨 AGUJERO seguridad |
| **🚨 SIN GUARD** | **REGISTRAR PAGO de deuda cliente (financiero)** | `POST /api/customers/:id/payments` registerCustomerPayment [customers.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/customers/customers.service.ts#L684-L849) | Botón "Registrar pago" en cuenta corriente | **SIN requirePermission**. Solo branch auth + caja abierta. Agrupa gestión financiera con datos básicos cliente. | 🚨 AGUJERO + AGRUPADO CRUD/Financiero |
| **proveedores.manage** | Crear proveedor | `POST /api/suppliers` suppliers.service | Nuevo proveedor | proveedores.manage L269. | ✅ OK |
| **proveedores.manage** | Editar / activar-desactivar proveedor | `PUT /api/suppliers/:id` | Editar | proveedores.manage; activo en payload. | ✅ OK |
| **proveedores.manage** | Eliminar proveedor | `DELETE /api/suppliers/:id` | Eliminar | proveedores.manage. | ✅ OK |
| **proveedores.manage** | Pagos financieros a proveedor | — | — | **NO están aquí**. Están en compras.manage (registerPurchasePayment). Separación correcta por accidente. | ℹ️ financiero en compras |

---

## B. SERVICIO TÉCNICO (RT) — TABLA OPERACIONES REALES

| Permiso RT | Operación concreta | Backend / archivo | Frontend acción | Restricciones / notas | Estado |
|---|---|---|---|---|---|
| **ordenesServicio.read** | Listar / ver OS, pagos, historial, presupuestos, garantías, equipos | GET `/rt/ordenes`, GET `/rt/ordenes/:id` rt.service L520-L630 | Panel "Órdenes Servicio" detalle | Sólo lectura. | ✅ |
| **ordenesServicio.write** | **CREAR Orden de Servicio** (OS) 👉 PUNTO 10 | `POST /rt/ordenes` createOrdenServicio [rt.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/rt/rt.service.ts#L632-L784) | "Nueva OS" | **Asignación técnico: payload opcional `tecnicoAsignadoId`.** Si usuario envía → se asigna. Si NO envía: **tecnicoAsignadoId queda `undefined` (sin asignar)**. El backend NO auto-asigna al técnico creador. (Caso B "técnico crea OS y se auto-asigna" → NO IMPLEMENTADO). | ⚠️ Sin auto-asignación |
| **ordenesServicio.write** | Agregar item (mano obra / repuesto / serv adic / accesorio) a OS | addOrdenItem [rt.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/rt/rt.service.ts#L1133-L1225) | Botón "+ Agregar ítem" presupuesto | ordenesServicio.write. Cada ítem usa payload `precioUnitario` y `descuentoItem` SIN límites rol. | ✅ protegido, sin límites precio |
| **ordenesServicio.write** | Quitar item OS (devuelve stock si repuesto) | removeOrdenItem (llamada addOrdenItem transacción L1218) | Menú "Eliminar ítem" | ordenesServicio.write. | ✅ |
| **ordenesServicio.write** | Crear NUEVA VERSIÓN presupuesto (modificar ítems/precios) | `POST /rt/ordenes/:id/presupuestos` crearVersionPresupuesto L948-L1013 rt.service | "Modificar presupuesto → Guardar nueva versión" | **ordenesServicio.write**. Cada versión recalcula totales con payload `descuentoTotal` (global) SIN límite rol. Cambia estado a ESPERANDO_APROBACION si OS está en RECIBIDO/DIAGNÓSTICO/PRESUPUESTO. Si presupuesto YA ESTÁ APROBADO, NO se bloquea crear nuevas versiones. | ⚠️ sin límites descuento rol, sin lock post-aprobación |
| **ordenesServicio.write** | Registrar diagnóstico OS (y transitar a DIAGNÓSTICO automático) | addDiagnostico L1088-L1128 rt.service | "Nuevo diagnóstico" en pestaña | ordenesServicio.write. Cambia estado RECIBIDO → DIAGNÓSTICO automático si aplica. | ✅ |
| **ordenesServicio.write** | Editar datos OS (cliente, equipo, etc.) 👉 NO DETERMINADO | routes/rt.ts update | Botón "Editar OS" | Export `updateOrdenServicio` no encontrado en service inspeccionado. Puede existir o no. | NO DETERMINADO |
| **ordenesServicio.cambioEstado** | **Cambiar ESTADO OS (cualquier transición)** | `PATCH /rt/ordenes/:id/estado` cambiarEstadoOrden [rt.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/rt/rt.service.ts#L822-L899) | Dropdown "Cambiar estado" OS | **Permite ESTADO arbitrario frontend** (salvo 2 reglas duras): <br> 1) ENTREGADO solo después pago completo (saldoPendiente < 0.005) ✅<br> 2) ENTREGADO → solo EN_GARANTÍA (no volver atrás) <br> 3) EN_GARANTÍA requiere ENTREGADO previo. <br> ❌ NO valida TÉCNICO RESPONSABLE vs entregador. <br> ❌ NO requiere Supervisor/Admin si otro técnico entrega. <br> ❌ NO registra "autorizante", solo "realizadoPorId". | 🚨 Entrega sin restricción entregador |
| **ordenesServicio.cambioEstado** | **ASIGNAR / REASIGNAR técnico** | `POST /rt/ordenes/:id/asignar-tecnico` asignarTecnicoOrden L901-L943 rt.service | Menú "Asignar técnico" + "Reasignar" | Usa ordenesServicio.cambioEstado (NO un permiso separado). Registra historial asignaciones. | ⚠️ Agrupado con todos cambios estado |
| **ordenesServicio.cambioEstado** | **ENTREGA OS** (marcar ENTREGADO) 👉 PUNTO 14 | cambiarEstadoOrden L848-L877 rt.service + autogenera garantías | Botón "Entregar al cliente" | **Frontend puede enviar estado=ENTREGADO y backend acepta.** Solo valida saldoPendiente === 0 (pagado). **NO valida**: técnico responsable, ni supervisor, ni rol vertical. Garantías se crean automáticamente en la misma transacción (ordenGarantia.createMany). | 🚨 ENTREGA SIN REGLAS |
| **ordenesServicio.aprobar** | **Aprobar / Rechazar presupuesto cliente** | `POST /rt/ordenes/:id/presupuestos/aprobar` aprobarPresupuestoCliente [rt.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/rt/rt.service.ts#L1015-L1083) | Botones "Aprobar" / "Rechazar" presupuesto | Si aprueba, copia totales versión presupuesto a ordenServicio y transita a ESTADO = APROBADO. Si rechaza, no cambia estado OS (solo rechaza presupuesto). | ✅ Permiso granular correcto |
| **pagosOrdenServicio.write** | **Registrar PAGO OS (parcial o total)** | `POST /rt/ordenes/:id/pagos` registrarPagoOrden [rt.service.ts](file:///C:/Users/HP/Desktop/WEB/rayegoPos/server/src/modules/rt/rt.service.ts#L1230-L1322) | "Registrar pago" en OS | Requiere CAJA ABIERTA (efectivo o digital). Actualiza `totalPagado` y `saldoPendiente`. **NO CAMBIA estadoActual de la OS a PAGADO. El enum NO tiene PAGADO.** Para cobrar y luego entregar, frontend debe 1) registrar pago (saldo → 0) y 2) luego cambiar estado a ENTREGADO manualmente. | ⚠️ Pago sin estado = PAGADO |
| **pagosOrdenServicio.write** | Modificar / anular pago OS | — routes/rt.ts | — | No existe endpoint delete/anular pago RT inspeccionado. | NO DETERMINADO |
| **equiposCliente.read** | Ver listado y detalle equipos del cliente | GET `/rt/equipos/:id` listEquiposCliente L299 | Pestaña Equipos cliente | Solo lectura. | ✅ |
| **equiposCliente.write** | Registrar nuevo equipo (marca, modelo, IMEI/serie, accesorios, condición física, observaciones) | `POST /rt/equipos` createEquipo L346 | "Nuevo Equipo" | equiposCliente.write. Datos completos (numeroSerie, accesorios, notasInternas). No delete endpoint. | ✅ |
| **equiposCliente.write** | Editar equipo (incl. activar/desactivar) | `PUT /rt/equipos/:id` updateEquipo L391 | Editar equipo | equiposCliente.write. payload.activo. | ✅ |
| **equiposCliente.write** | Eliminar equipo | — routes/rt.ts | — | **No existe DELETE endpoint equipos en routes/rt.ts inspeccionado.** Ni deleteEquipo export en rt.service. | NO DETERMINADO. Probablemente NO IMPLEMENTADO |
| **garantiasOrdenServicio.read** | Ver garantías | Incluido en ordenInclude garantias: L503 | Pestaña Garantías OS | Solo lectura desde relación OS. | ✅ |
| **garantiasOrdenServicio.write** | Crear/gestionar solicitud garantía independiente | — | — | **NO existe el permiso `garantiasOrdenServicio.write` EN CATÁLOGO 40 canónicos.** NO hay endpoints independientes. Garantías SE CREAN AUTOMÁTICAMENTE al ENTREGAR OS (cambiarEstadoOrden ENTREGADO L864). Usa permiso ordenesServicio.cambioEstado indirectamente. | 🚨 NO catalogado. Agrupado |
| **tecnicos.read** / **tecnicos.write** | CRUD técnico (perfil técnico) | `GET/POST/PUT/DELETE /rt/tecnicos` rt.service L154-L292 | Catálogo Técnicos Config | Correctamente segmentados. | ✅ OK |

---

### Punto 10 RESUMEN — CASO CREACIÓN OS CAJERO ST vs TÉCNICO ST

**Situación ACTUAL vs esperada:**

| Caso | Esperado funcional | Real código |
|---|---|---|
| **CASO A — Cajero ST crea OS** | 1) Selecciona/crea cliente; 2) registra equipo; 3) crea OS; 4) **selecciona técnico** manualmente. | Compatible. `createOrdenServicio` acepta `tecnicoAsignadoId` opcional en payload. ✅ |
| **CASO B — Técnico crea OS** | 1) Cliente/equipo; 2) crea OS; 3) **SISTEMA AUTO-ASIGNA al técnico creador como responsable.** | ❌ NO IMPLEMENTADO. Si técnico creador NO envía `tecnicoAsignadoId` en el POST, la OS se crea con `tecnicoAsignadoId = NULL` (sin responsable). Debe enviar su propio tecnicoId manualmente o un supervisor asignarle después. |
| **Roles diferenciados CAJERO_ST / TECNICO_ST / SUPERVISOR_ST** | Existen como roles separados en la matriz funcional. | ❌ **NO EXISTEN en AuthRole ni en BD.** Solo hay roles genéricos: `CAJERO`, `TECNICO`, `SUPERVISOR` (sin sufijo ST/vertical). Arrays actuales: CAJERO = 6 permisos solo-read generales (sin ST ni manage); TECNICO = 9 generales sin ST; SUPERVISOR = 0. Ninguno tiene permisos ST hoy. |

---

## C. OPERACIONES SIN PERMISO GRANULAR — AGRUPACIONES EXCESIVAS

Lista de operaciones que viven dentro de un `.manage` genérico y **conceptualmente deberían tener permisos propios** o separarse:

1. **compras.manage** = agrupa 3 dominios funcionales MUY SEPARADOS:
   - 🛒 Crear / editar / aprobar compra (ADMIN compras)
   - 📦 **Recepción física de mercadería (ALMACÉN)** → debería ser permiso separado (ej: `compras.recibir`)
   - 💸 Pago a proveedor + devoluciones

2. **productos.manage** = agrupa 6 catálogos maestros + CRUD producto + inventario inicial:
   - Categorías / Laboratorios / Principios activos / Tipos comerciales / Presentaciones / Unidades
   - Debería existir al menos: `productos.catalogo.manage` y `productos.maestros.manage`

3. **clientes.manage + falta guards** = crea/edita/elimina cliente **+** datos financieros (límite crédito) **+** registrar pagos deuda. **Financiero (pagos/límite) debería ser permiso separado** (`clientes.financiero.manage`). Esta agrupación es crítica para rol CAJERO ST recepción: hoy no puede registrar cliente sin también poder cargar límite crédito y eliminar.

4. **ordenesServicio.cambioEstado** = agrupa:
   - Cambios estados técnicos (EN_REPARACIÓN, EN_PRUEBAS, etc.)
   - Asignación / reasignación de técnico
   - **Entrega de OS al cliente** (operación de caja/financiera/control)
   Deberían ser al menos 2: `ordenesServicio.cambiarEstadoTecnico` vs `ordenesServicio.entregar` vs `ordenesServicio.asignar`.

5. **caja.manage** = Operar caja (movimientos, apertura) + Cierre definitivo (con regla vertical). Aunque el cierre definitivo ya tiene `requireCanCloseCashDrawer` adicional, sigue siendo el mismo código de permiso para ambos.

6. **OrdenesServicio presupuesto (descuentos) + items** → descuentoItem por línea + descuentoTotal global, ambos sin límites. Deberían pasar por lógica aprobación si superan umbral.

---

## D. SEGURIDAD — OPERACIONES SIN PROTECCIÓN BACKEND ADECUADA

*No basta con `AuthorizationGate` en frontend; estos endpoints carecen de `requirePermission(...)` en backend o son insuficientes.*

| Operación | Endpoint | Guarda actual | Problema |
|---|---|---|---|
| **Crear cliente** | `POST /api/customers` createCustomer | Sólo requireBranchAuthContext (login válido + empresa/sucursal OK) | FALTA clientes.manage. Cualquier usuario autenticado de la sucursal puede crear cliente, incluso cargar `limiteCredito` arbitrario. 🚨 CRÍTICO |
| **Eliminar cliente** | `DELETE /api/customers/:id` deleteCustomer | Sólo requireBranchAuthContext | FALTA clientes.manage. Cualquiera puede borrar. 🚨 CRÍTICO |
| **Registrar pago deuda cliente (financiero)** | `POST /api/customers/:id/payments` registerCustomerPayment | Sólo requireBranchAuthContext + caja abierta | FALTA clientes.manage. Cualquiera registra pago y modifica saldo cuenta corriente. 🚨 CRÍTICO |
| **Guardar conciliación de caja** | `POST /cashier/reconciliation` saveCashReconciliation | ownership usuarioId === apertura.usuarioId. Sin requirePermission. | Falta `requirePermission('caja.manage')`. Cualquier dueño de caja sin caja.manage (por ej, usuario con login pero sin permiso) podría en teoría. Menor porque ownership filtra, pero no cumple doble defensa. ⚠️ |
| **Registrar arqueo de caja** | `POST /cashier/cash-count` createCashCount | ownership usuarioId === apertura.usuarioId. Sin requirePermission. | Mismo que conciliación: falta `requirePermission('caja.manage')`. ⚠️ |
| **Estado PAGADO auto en RT** | `POST /rt/ordenes/:id/pagos` | pagosOrdenServicio.write correcto, pero... | Después de pagar, `saldoPendiente=0` pero el **estado de la OS sigue siendo el que era** (ej: EN_REPARACION). Enum EstadoOrdenServicio **NO tiene valor PAGADO**. Para que frontend marque ENTREGADO debe simplemente enviar PATCH con estado=ENTREGADO, que solo valida saldo 0. El frontend puede saltarse cualquier restricción "el trabajo está listo" ya que no valida estado técnico antes de ENTREGAR (solo saldo 0). ⚠️ |
| **Entrega OS RT** | `PATCH /rt/ordenes/:id/estado` ENTREGADO | ordenesServicio.cambioEstado | No verifica que el entregador sea técnico responsable, ni requiere Supervisor/Admin si entrega otro técnico. Cualquier usuario con ordenesServicio.cambioEstado entrega OS. 🚨 |
| **Descuentos ventas** | `POST /api/sales` | discountTotal >= 0 y < gross | Sin límite porcentaje por rol. 100% permitido a cualquiera con ventas.manage. ⚠️ |
| **Descuentos presupuesto RT items y global** | addOrdenItem, crearVersionPresupuesto | descuentoItem >=0 + descuentoTotal >=0 | Sin límite por rol en RT. Técnico/Operador puede poner 100% descuento sin aprobación. ⚠️ |

### Resumen SEGURIDAD MULTIEMPRESA / SUCURSAL (Punto 18):

| Check | Resultado |
|---|---|
| EmpresaId se obtiene desde JWT/sesión? | ✅ Sí, en **TODAS** las funciones inspeccionadas se usa `requireBranchAuthContext()` → `companyId` y `branchId` vienen del JWT. |
| Backend acepta empresaId/branchId enviados por frontend en payload? | Generalmente **NO se aceptan**: WHERE siempre usa `companyId` del contexto. Excepciones de **validación de coincidencia**:<br>- `POST /api/purchases/orders` sucursalId opcional payload → **si difiere de branchId sesión → 403**.<br>- `POST /api/sales`, `POST /inventory/lots` idem. |
| Verifica autorización del usuario sobre empresa/sucursal? | ✅ `requireBranchAuthContext` valida que usuario tenga relación con empresa y sucursal tenga activo=true y empresaId coincida. Si empresa inactiva → 409 EMPRESA_INACTIVA (salvo ADMIN_POS bypass). |
| Usuario opera múltiples sucursales en misma sesión? | ❌ No. Cada sesión tiene 1 `branchId` activa (del JWT). |

---

## E. DIFERENCIAS CON NUESTRA MATRIZ FUNCIONAL

*(solo diferencias)*

| Regla funcional esperada | Situación real código |
|---|---|
| ALMACÉN: recibe mercadería físicamente, NO crea compras, NO paga proveedor. | 🚨 `compras.manage` es TODO o nada. Recepción = mismo permiso que crear compra y pagar. ALMACÉN debe recibir compras.manage completo → rompe diseño (accedería a pagos proveedor). |
| CAJERO: opera caja pero NO puede cerrar definitivamente | ✅ Cierre tiene `requireCanCloseCashDrawer()` (BOTICA: ADMIN_BOTICA/SUPERVISOR; ST: ADMIN_ST). CAJERO sin permiso vertical no cierra. Implementado OK. |
| Roles diferenciados ST: CAJERO_ST / TÉCNICO_ST / SUPERVISOR_ST / ADMIN_ST | ❌ No existen roles con sufijo ST. Solo roles genéricos CAJERO/TÉCNICO/SUPERVISOR (y ADMIN_BOTICA/ADMIN_ST verticales). Arrays actuales de CAJERO y TÉCNICO carecen de cualquier permiso ST. |
| Técnico crea OS → auto-asignarse como responsable | ❌ createOrdenServicio NO rellena tecnicoAsignadoId a partir del userId. Debe enviar payload.tecnicoAsignadoId o quedar NULL. |
| Entrega OS: técnico responsable puede entregar. Otro técnico → requiere Supervisor/Admin. Supervisor/Admin entregan siempre. | ❌ No hay validación. Cualquier usuario con ordenesServicio.cambioEstado entrega. No registra autorizante. |
| Estado = PAGADO se genera automáticamente al registrar pago (saldo = 0) | ❌ No hay estado PAGADO en el enum. Pago solo actualiza saldoPendiente, no estadoActual. |
| ENTREGADO requiere que esté PAGADO (saldoPendiente = 0) | ✅ Implementado OK en cambiarEstadoOrden L849. |
| Límites descuento por rol: CAJERO_ST ≤10%, SUPERVISOR_ST ≤20%, ADMIN_ST ilimitado. | ❌ Cero implementación. Ventas.manage y RT items aceptan 100%. |
| Garantías: flujo solicitud → diagnóstico → aprobar/rechazar → atención. | ❌ No hay permiso write ni flujo. Garantías se CREAN AUTOMÁTICAMENTE al ENTREGAR la OS (con días por defecto). No hay gestión post-venta. |
| Cajero ST registra cliente y equipo, pero NO gestiona límite crédito ni finanzas. | 🚨 Imposible hoy: (1) crear cliente SIN permiso (aguard); (2) cliente.manage = TODO o nada, incluyendo límite crédito. Registrar pago de cliente = SIN guarda hoy también. |
| Proveedores: pagos financieros separados de compras. | ℹ️ Pagos proveedor están DENTRO de compras.manage, no en proveedores.manage. Coincide con que ADMIN gestiona todo compras (hoy), pero la agrupación no ayuda a separar. |

---

## F. PERMISOS QUE PODRÍAN NECESITAR SEPARACIÓN

*NO crear. Solo recomendación de evaluación antes de matriz final.*

1. **`compras.recibir`** (separado de `compras.manage`)
   * Para rol ALMACÉN. Solo receivePurchaseItem + createPurchaseReception. Sin crear compra, sin pagar proveedor.

2. **`clientes.financiero.manage`** (separado de `clientes.manage` CRUD básico)
   * Registrar pagos deuda / cambiar límite crédito / activar crédito. Roles que lo necesiten: ADMIN_BOTICA, SUPERVISOR, pero NO CAJERO básico. CAJERO ST necesitaría `clientes.manage` (CRUD básico datos) pero sin financiero.

3. **`ordenesServicio.entregar`** (separado de `ordenesServicio.cambioEstado`)
   * Con reglas: solo técnico responsable, o Supervisor/Admin (registrando autorizante), o técnico no responsable con supervisorAutorizaId obligatorio.

4. **`ordenesServicio.asignar`** (separado de cambioEstadoTecnico)
   * Asignar/reasignar técnico requiere ADMIN_ST o SUPERVISOR_ST.

5. **`ordenesServicio.cambiarEstadoTecnico`** (el resto del actual cambioEstado)
   * Cambios EN_REPARACIÓN → EN_PRUEBAS → LISTO_PARA_COBRO / etc. Técnico responsable puede.

6. **`caja.conciliar`** o absorberse en caja.manage pero agregar requirePermission a saveCashReconciliation y createCashCount.

7. **`descuentos.ventas.10pct / descuentos.ventas.20pct / descuentos.ventas.libre`** o bien lógica centralizada con límites por rol en backend (sin nuevos permisos, por config).

8. **`garantiasOrdenServicio.write`** — catálogo ya lo define? No: en catálogo 40 canónicos SOLO hay `garantiasOrdenServicio.read`. Agregar write si se implementa flujo post-venta.

---

## G. PUNTOS QUE NECESITAN DECISIÓN ANTES DE IMPLEMENTAR

*Lista corta, ordenada por prioridad*

### G1 🔴 CRÍTICO: Modelo de roles ST (Punto 10 + matriz)
- **Decisión**: ¿Mantenemos roles genéricos `CAJERO/TÉCNICO/SUPERVISOR` con permisos ST compartidos vía matriz? O creamos nuevos roles `CAJERO_ST / TÉCNICO_ST / SUPERVISOR_ST` (multiplicando roles)?
- **Impacto**: BD roles, AuthRole enum, arrays rolePermissions, routeDefinitions, tests.

### G2 🔴 CRÍTICO: Separación `compras.manage` → `compras.recibir` para ALMACÉN
- ALMACÉN requiere recepción pero no creación de compra ni pago. Sin esto no se puede asignar matriz.

### G3 🔴 CRÍTICO: 3 agujeros backend cliente (Punto D)
- Decisión técnico: **deben agregarse `requirePermission('clientes.manage')` a createCustomer, deleteCustomer, registerCustomerPayment**, o crear `clientes.financiero.manage` solo para registerCustomerPayment+limiteCredito? *Pendiente de aprobación usuario antes de tocar código.*

### G4 🟡 Entrega OS: reglas + PAGADO inexistente
- **Decisión A**: ¿Agregamos `PAGADO` a enum EstadoOrdenServicio y actualizamos automáticamente al pagar?
- **Decisión B**: ¿Requerimos estado = LISTO_PARA_COBRO antes de ENTREGADO (además de saldo=0)? ¿O solo saldo=0 basta?
- **Decisión C**: Reglas entregador: técnico responsable sí; otro técnico requiere SupervisorAutorizaId; Supervisor/Admin sí. ¿Registrar ambos ids?

### G5 🟡 Modelo descuentos: ¿Nuevos permisos o límite por config de roles?
- Opción X: Nuevos permisos `descuento.ventas.10/20/libre` (granular)
- Opción Y: Tabla/objeto config `discountLimitByRole` en settings company (menos permisos nuevos)
- ¿Ventas vs ST mismos límites o independientes? (ej: cajero ventas vs cajero ST)

### G6 🟡 Técnico crea OS → ¿Auto-asignación sí o no?
- Implementar: si usuario creador tiene perfil de técnico relacionado (usuarioId == tecnico.usuarioId) y NO envió tecnicoAsignadoId, asignarse automáticamente.

### G7 🟡 Garantías: ¿Flujo independiente o autogenerado al entregar?
- Hoy autogenerado. Si queremos flujo completo solicitud/aprobación/atención postventa, se necesita: (a) agregar `garantiasOrdenServicio.write` a catálogo canónico (actualmente 40 solo read); (b) crear endpoints CRUD garantía.

### G8 🟡 Conciliación/Arqueo caja: ¿Agregar requirePermission(caja.manage) a los 2 endpoints faltantes o dejar como ownership suficiente?
- Recomendación: agregar (defensa en profundidad).

---

### NOTAS FINALES METODOLOGÍA
- Código inspeccionado: `server/src/modules/*` (sales, cashier, purchases, products, inventory, customers, suppliers, rt) + `server/src/routes/*.ts` + `server/src/lib/auth.ts` + `src/config/*` + `src/pages/OrdenesServicioPage.tsx` AuthorizationGates + `src/config/navigation.ts`.
- **NO se modificó ningún archivo durante la auditoría.**
- Builds últimos verificados exit 0 (post 40 permisos, post reglas caja). Reporte se basa en código fuente actual develop.
- Estados marcados como **NO DETERMINADO**: funciones deleteEquipo, updateOrdenServicio, delete/anular pago RT, endpoints faltantes en routes inspeccionadas.
