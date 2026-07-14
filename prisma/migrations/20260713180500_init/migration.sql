-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccionAuditoria" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'ANULAR');

-- CreateEnum
CREATE TYPE "public"."TipoDocumentoIdentidad" AS ENUM ('DNI', 'RUC', 'CE', 'PASAPORTE', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "public"."EstadoProducto" AS ENUM ('ACTIVO', 'INACTIVO', 'DESCONTINUADO');

-- CreateEnum
CREATE TYPE "public"."EstadoLote" AS ENUM ('ACTIVO', 'BLOQUEADO', 'VENCIDO', 'AGOTADO');

-- CreateEnum
CREATE TYPE "public"."EstadoCompra" AS ENUM ('BORRADOR', 'REGISTRADA', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "public"."EstadoVenta" AS ENUM ('BORRADOR', 'EMITIDA', 'COBRADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "public"."TipoComprobante" AS ENUM ('TICKET', 'BOLETA', 'FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "public"."TipoMovimientoInventario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'RESERVA', 'LIBERACION', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "public"."OrigenMovimientoInventario" AS ENUM ('COMPRA', 'VENTA', 'AJUSTE', 'DEVOLUCION_COMPRA', 'DEVOLUCION_VENTA', 'TRANSFERENCIA', 'REGULARIZACION', 'APERTURA');

-- CreateEnum
CREATE TYPE "public"."TipoMovimientoCaja" AS ENUM ('APERTURA', 'INGRESO', 'EGRESO', 'VENTA', 'CIERRE', 'AJUSTE');

-- CreateEnum
CREATE TYPE "public"."OperacionCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "public"."EstadoCaja" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "public"."EstadoAperturaCaja" AS ENUM ('ABIERTA', 'CERRADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "public"."CodigoFormaPago" AS ENUM ('EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoImpuesto" AS ENUM ('IGV', 'ISC', 'ICBPER', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."AmbitoConfiguracion" AS ENUM ('EMPRESA', 'SUCURSAL');

-- CreateTable
CREATE TABLE "public"."empresas" (
    "id" UUID NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "tipo_documento" "public"."TipoDocumentoIdentidad" NOT NULL DEFAULT 'RUC',
    "numero_documento" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "telefono" VARCHAR(30),
    "direccion" VARCHAR(255),
    "ubigeo" VARCHAR(6),
    "moneda_base" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "zona_horaria" VARCHAR(60) NOT NULL DEFAULT 'America/Lima',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sucursales" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "direccion" VARCHAR(255),
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "ubigeo" VARCHAR(6),
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuarios" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150),
    "password_hash" VARCHAR(255) NOT NULL,
    "nombres" VARCHAR(120) NOT NULL,
    "apellidos" VARCHAR(120) NOT NULL,
    "tipo_documento" "public"."TipoDocumentoIdentidad",
    "numero_documento" VARCHAR(20),
    "telefono" VARCHAR(30),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permisos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "modulo" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuario_rol" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rol_permiso" (
    "id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categorias" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."laboratorios" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "pais" VARCHAR(80),
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "laboratorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."presentaciones" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "presentaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."unidades_medida" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "simbolo" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."principios_activos" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "principios_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."productos" (
    "id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "laboratorio_id" UUID,
    "presentacion_id" UUID,
    "unidad_medida_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "codigo_interno" VARCHAR(50),
    "codigo_barras" VARCHAR(50),
    "nombre" VARCHAR(180) NOT NULL,
    "descripcion" VARCHAR(500),
    "concentracion" VARCHAR(120),
    "registro_sanitario" VARCHAR(100),
    "requiere_receta" BOOLEAN NOT NULL DEFAULT false,
    "es_controlado" BOOLEAN NOT NULL DEFAULT false,
    "precio_venta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_referencia" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "margen_referencia" DECIMAL(7,4),
    "estado" "public"."EstadoProducto" NOT NULL DEFAULT 'ACTIVO',
    "observaciones" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."producto_principio_activo" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "principio_activo_id" UUID NOT NULL,
    "concentracion" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "producto_principio_activo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."producto_impuesto" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "impuesto_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "producto_impuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventario" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "ubicacion" VARCHAR(120),
    "stock_minimo" DECIMAL(18,4),
    "stock_maximo" DECIMAL(18,4),
    "punto_reorden" DECIMAL(18,4),
    "permite_venta_sin_stock" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lotes" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "detalle_compra_id" UUID,
    "proveedor_id" UUID,
    "numero_lote" VARCHAR(80) NOT NULL,
    "fecha_fabricacion" DATE,
    "fecha_vencimiento" DATE NOT NULL,
    "costo_unitario" DECIMAL(14,6) NOT NULL,
    "stock_inicial" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stock_disponible" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stock_reservado" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "estado" "public"."EstadoLote" NOT NULL DEFAULT 'ACTIVO',
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."motivos_movimiento" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "tipo" "public"."TipoMovimientoInventario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "motivos_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."movimientos_inventario" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "lote_id" UUID,
    "motivo_id" UUID,
    "detalle_compra_id" UUID,
    "detalle_venta_id" UUID,
    "detalle_venta_lote_id" UUID,
    "tipo" "public"."TipoMovimientoInventario" NOT NULL,
    "origen" "public"."OrigenMovimientoInventario" NOT NULL,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "costo_unitario" DECIMAL(14,6),
    "stock_resultante" DECIMAL(18,4),
    "referencia" VARCHAR(120),
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proveedores" (
    "id" UUID NOT NULL,
    "tipo_persona" "public"."TipoPersona" NOT NULL DEFAULT 'JURIDICA',
    "tipo_documento" "public"."TipoDocumentoIdentidad" NOT NULL DEFAULT 'RUC',
    "numero_documento" VARCHAR(20) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "contacto_nombre" VARCHAR(150),
    "contacto_telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "ubigeo" VARCHAR(6),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."compras" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "usuario_responsable_id" UUID NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_recepcion" TIMESTAMP(3),
    "tipo_comprobante" "public"."TipoComprobante",
    "serie_comprobante" VARCHAR(20),
    "numero_comprobante" VARCHAR(30),
    "estado" "public"."EstadoCompra" NOT NULL DEFAULT 'BORRADOR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuento_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuesto_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo_pendiente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."detalle_compra" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "costo_unitario" DECIMAL(14,6) NOT NULL,
    "descuento_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "porcentaje_impuesto" DECIMAL(7,4),
    "impuesto_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "detalle_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clientes" (
    "id" UUID NOT NULL,
    "tipo_persona" "public"."TipoPersona" NOT NULL DEFAULT 'NATURAL',
    "tipo_documento" "public"."TipoDocumentoIdentidad",
    "numero_documento" VARCHAR(20),
    "nombres" VARCHAR(120),
    "apellidos" VARCHAR(120),
    "razon_social" VARCHAR(200),
    "nombre_completo" VARCHAR(200),
    "email" VARCHAR(150),
    "telefono" VARCHAR(30),
    "direccion" VARCHAR(255),
    "ubigeo" VARCHAR(6),
    "fecha_nacimiento" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ventas" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "cliente_id" UUID,
    "usuario_responsable_id" UUID NOT NULL,
    "serie_documento_id" UUID,
    "tipo_comprobante" "public"."TipoComprobante" NOT NULL DEFAULT 'TICKET',
    "serie" VARCHAR(20),
    "numero" VARCHAR(30),
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "estado" "public"."EstadoVenta" NOT NULL DEFAULT 'BORRADOR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuento_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuesto_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vuelto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo_pendiente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."detalle_venta" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "precio_unitario" DECIMAL(14,6) NOT NULL,
    "descuento_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "porcentaje_impuesto" DECIMAL(7,4),
    "impuesto_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_referencia" DECIMAL(14,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "detalle_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."detalle_venta_lote" (
    "id" UUID NOT NULL,
    "detalle_venta_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "costo_unitario" DECIMAL(14,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "detalle_venta_lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."formas_pago" (
    "id" UUID NOT NULL,
    "codigo" "public"."CodigoFormaPago" NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "requiere_referencia" BOOLEAN NOT NULL DEFAULT false,
    "permite_vuelto" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "formas_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."venta_pagos" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "forma_pago_id" UUID NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia_externa" VARCHAR(120),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "venta_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cajas" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(255),
    "estado" "public"."EstadoCaja" NOT NULL DEFAULT 'ACTIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."apertura_caja" (
    "id" UUID NOT NULL,
    "caja_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_apertura_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "estado" "public"."EstadoAperturaCaja" NOT NULL DEFAULT 'ABIERTA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "apertura_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cierre_caja" (
    "id" UUID NOT NULL,
    "apertura_caja_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_sistema_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monto_declarado_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "diferencia_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."movimientos_caja" (
    "id" UUID NOT NULL,
    "apertura_caja_id" UUID NOT NULL,
    "forma_pago_id" UUID,
    "venta_pago_id" UUID,
    "tipo" "public"."TipoMovimientoCaja" NOT NULL,
    "operacion" "public"."OperacionCaja" NOT NULL,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldo_resultante" DECIMAL(14,2),
    "referencia" VARCHAR(120),
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingresos" (
    "id" UUID NOT NULL,
    "movimiento_caja_id" UUID NOT NULL,
    "concepto" VARCHAR(120) NOT NULL,
    "referencia" VARCHAR(120),
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."egresos" (
    "id" UUID NOT NULL,
    "movimiento_caja_id" UUID NOT NULL,
    "concepto" VARCHAR(120) NOT NULL,
    "referencia" VARCHAR(120),
    "observaciones" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "egresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."configuracion" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sucursal_id" UUID,
    "ambito" "public"."AmbitoConfiguracion" NOT NULL,
    "clave" VARCHAR(120) NOT NULL,
    "valor_texto" VARCHAR(500),
    "valor_numero" DECIMAL(18,4),
    "valor_booleano" BOOLEAN,
    "valor_json" JSONB,
    "descripcion" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."series_documentos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sucursal_id" UUID,
    "tipo_comprobante" "public"."TipoComprobante" NOT NULL,
    "serie" VARCHAR(20) NOT NULL,
    "siguiente_numero" INTEGER NOT NULL DEFAULT 1,
    "longitud_numero" INTEGER NOT NULL DEFAULT 8,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "series_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."impuestos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "tipo" "public"."TipoImpuesto" NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "incluido_en_precio" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "impuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "tabla" VARCHAR(120) NOT NULL,
    "registro_id" UUID,
    "accion" "public"."AccionAuditoria" NOT NULL,
    "fecha_evento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "direccion_ip" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_numero_documento_key" ON "public"."empresas"("numero_documento");

-- CreateIndex
CREATE INDEX "empresas_deleted_at_idx" ON "public"."empresas"("deleted_at");

-- CreateIndex
CREATE INDEX "sucursales_empresa_id_nombre_idx" ON "public"."sucursales"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "sucursales_deleted_at_idx" ON "public"."sucursales"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_empresa_id_codigo_key" ON "public"."sucursales"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "public"."usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "public"."usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_sucursal_id_idx" ON "public"."usuarios"("sucursal_id");

-- CreateIndex
CREATE INDEX "usuarios_numero_documento_idx" ON "public"."usuarios"("numero_documento");

-- CreateIndex
CREATE INDEX "usuarios_deleted_at_idx" ON "public"."usuarios"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "public"."roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "public"."roles"("nombre");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "public"."roles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "public"."permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_modulo_activo_idx" ON "public"."permisos"("modulo", "activo");

-- CreateIndex
CREATE INDEX "permisos_deleted_at_idx" ON "public"."permisos"("deleted_at");

-- CreateIndex
CREATE INDEX "usuario_rol_rol_id_activo_idx" ON "public"."usuario_rol"("rol_id", "activo");

-- CreateIndex
CREATE INDEX "usuario_rol_deleted_at_idx" ON "public"."usuario_rol"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_rol_usuario_id_rol_id_key" ON "public"."usuario_rol"("usuario_id", "rol_id");

-- CreateIndex
CREATE INDEX "rol_permiso_permiso_id_idx" ON "public"."rol_permiso"("permiso_id");

-- CreateIndex
CREATE INDEX "rol_permiso_deleted_at_idx" ON "public"."rol_permiso"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "rol_permiso_rol_id_permiso_id_key" ON "public"."rol_permiso"("rol_id", "permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "public"."categorias"("nombre");

-- CreateIndex
CREATE INDEX "categorias_deleted_at_idx" ON "public"."categorias"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "laboratorios_nombre_key" ON "public"."laboratorios"("nombre");

-- CreateIndex
CREATE INDEX "laboratorios_deleted_at_idx" ON "public"."laboratorios"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "presentaciones_nombre_key" ON "public"."presentaciones"("nombre");

-- CreateIndex
CREATE INDEX "presentaciones_deleted_at_idx" ON "public"."presentaciones"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_codigo_key" ON "public"."unidades_medida"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_nombre_key" ON "public"."unidades_medida"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_simbolo_key" ON "public"."unidades_medida"("simbolo");

-- CreateIndex
CREATE INDEX "unidades_medida_deleted_at_idx" ON "public"."unidades_medida"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "principios_activos_nombre_key" ON "public"."principios_activos"("nombre");

-- CreateIndex
CREATE INDEX "principios_activos_deleted_at_idx" ON "public"."principios_activos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "public"."productos"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_interno_key" ON "public"."productos"("codigo_interno");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_barras_key" ON "public"."productos"("codigo_barras");

-- CreateIndex
CREATE INDEX "productos_categoria_id_estado_idx" ON "public"."productos"("categoria_id", "estado");

-- CreateIndex
CREATE INDEX "productos_laboratorio_id_idx" ON "public"."productos"("laboratorio_id");

-- CreateIndex
CREATE INDEX "productos_nombre_idx" ON "public"."productos"("nombre");

-- CreateIndex
CREATE INDEX "productos_deleted_at_idx" ON "public"."productos"("deleted_at");

-- CreateIndex
CREATE INDEX "producto_principio_activo_principio_activo_id_idx" ON "public"."producto_principio_activo"("principio_activo_id");

-- CreateIndex
CREATE INDEX "producto_principio_activo_deleted_at_idx" ON "public"."producto_principio_activo"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "producto_principio_activo_producto_id_principio_activo_id_key" ON "public"."producto_principio_activo"("producto_id", "principio_activo_id");

-- CreateIndex
CREATE INDEX "producto_impuesto_impuesto_id_idx" ON "public"."producto_impuesto"("impuesto_id");

-- CreateIndex
CREATE INDEX "producto_impuesto_deleted_at_idx" ON "public"."producto_impuesto"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "producto_impuesto_producto_id_impuesto_id_key" ON "public"."producto_impuesto"("producto_id", "impuesto_id");

-- CreateIndex
CREATE INDEX "inventario_producto_id_idx" ON "public"."inventario"("producto_id");

-- CreateIndex
CREATE INDEX "inventario_deleted_at_idx" ON "public"."inventario"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_sucursal_id_producto_id_key" ON "public"."inventario"("sucursal_id", "producto_id");

-- CreateIndex
CREATE INDEX "lotes_producto_id_fecha_vencimiento_idx" ON "public"."lotes"("producto_id", "fecha_vencimiento");

-- CreateIndex
CREATE INDEX "lotes_sucursal_id_fecha_vencimiento_idx" ON "public"."lotes"("sucursal_id", "fecha_vencimiento");

-- CreateIndex
CREATE INDEX "lotes_stock_disponible_idx" ON "public"."lotes"("stock_disponible");

-- CreateIndex
CREATE INDEX "lotes_deleted_at_idx" ON "public"."lotes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_sucursal_id_producto_id_numero_lote_key" ON "public"."lotes"("sucursal_id", "producto_id", "numero_lote");

-- CreateIndex
CREATE UNIQUE INDEX "motivos_movimiento_codigo_key" ON "public"."motivos_movimiento"("codigo");

-- CreateIndex
CREATE INDEX "motivos_movimiento_tipo_activo_idx" ON "public"."motivos_movimiento"("tipo", "activo");

-- CreateIndex
CREATE INDEX "motivos_movimiento_deleted_at_idx" ON "public"."motivos_movimiento"("deleted_at");

-- CreateIndex
CREATE INDEX "movimientos_inventario_sucursal_id_fecha_movimiento_idx" ON "public"."movimientos_inventario"("sucursal_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_inventario_producto_id_fecha_movimiento_idx" ON "public"."movimientos_inventario"("producto_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_inventario_lote_id_fecha_movimiento_idx" ON "public"."movimientos_inventario"("lote_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_inventario_tipo_origen_idx" ON "public"."movimientos_inventario"("tipo", "origen");

-- CreateIndex
CREATE INDEX "movimientos_inventario_deleted_at_idx" ON "public"."movimientos_inventario"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_numero_documento_key" ON "public"."proveedores"("numero_documento");

-- CreateIndex
CREATE INDEX "proveedores_razon_social_idx" ON "public"."proveedores"("razon_social");

-- CreateIndex
CREATE INDEX "proveedores_deleted_at_idx" ON "public"."proveedores"("deleted_at");

-- CreateIndex
CREATE INDEX "compras_sucursal_id_fecha_emision_idx" ON "public"."compras"("sucursal_id", "fecha_emision");

-- CreateIndex
CREATE INDEX "compras_proveedor_id_fecha_emision_idx" ON "public"."compras"("proveedor_id", "fecha_emision");

-- CreateIndex
CREATE INDEX "compras_estado_idx" ON "public"."compras"("estado");

-- CreateIndex
CREATE INDEX "compras_deleted_at_idx" ON "public"."compras"("deleted_at");

-- CreateIndex
CREATE INDEX "detalle_compra_compra_id_idx" ON "public"."detalle_compra"("compra_id");

-- CreateIndex
CREATE INDEX "detalle_compra_producto_id_idx" ON "public"."detalle_compra"("producto_id");

-- CreateIndex
CREATE INDEX "detalle_compra_deleted_at_idx" ON "public"."detalle_compra"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_numero_documento_key" ON "public"."clientes"("numero_documento");

-- CreateIndex
CREATE INDEX "clientes_nombre_completo_idx" ON "public"."clientes"("nombre_completo");

-- CreateIndex
CREATE INDEX "clientes_razon_social_idx" ON "public"."clientes"("razon_social");

-- CreateIndex
CREATE INDEX "clientes_deleted_at_idx" ON "public"."clientes"("deleted_at");

-- CreateIndex
CREATE INDEX "ventas_sucursal_id_fecha_emision_idx" ON "public"."ventas"("sucursal_id", "fecha_emision");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_fecha_emision_idx" ON "public"."ventas"("cliente_id", "fecha_emision");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "public"."ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_deleted_at_idx" ON "public"."ventas"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_serie_documento_id_numero_key" ON "public"."ventas"("serie_documento_id", "numero");

-- CreateIndex
CREATE INDEX "detalle_venta_venta_id_idx" ON "public"."detalle_venta"("venta_id");

-- CreateIndex
CREATE INDEX "detalle_venta_producto_id_idx" ON "public"."detalle_venta"("producto_id");

-- CreateIndex
CREATE INDEX "detalle_venta_deleted_at_idx" ON "public"."detalle_venta"("deleted_at");

-- CreateIndex
CREATE INDEX "detalle_venta_lote_lote_id_idx" ON "public"."detalle_venta_lote"("lote_id");

-- CreateIndex
CREATE INDEX "detalle_venta_lote_deleted_at_idx" ON "public"."detalle_venta_lote"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_venta_lote_detalle_venta_id_lote_id_key" ON "public"."detalle_venta_lote"("detalle_venta_id", "lote_id");

-- CreateIndex
CREATE UNIQUE INDEX "formas_pago_codigo_key" ON "public"."formas_pago"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "formas_pago_nombre_key" ON "public"."formas_pago"("nombre");

-- CreateIndex
CREATE INDEX "formas_pago_activo_orden_idx" ON "public"."formas_pago"("activo", "orden");

-- CreateIndex
CREATE INDEX "formas_pago_deleted_at_idx" ON "public"."formas_pago"("deleted_at");

-- CreateIndex
CREATE INDEX "venta_pagos_venta_id_fecha_pago_idx" ON "public"."venta_pagos"("venta_id", "fecha_pago");

-- CreateIndex
CREATE INDEX "venta_pagos_forma_pago_id_idx" ON "public"."venta_pagos"("forma_pago_id");

-- CreateIndex
CREATE INDEX "venta_pagos_deleted_at_idx" ON "public"."venta_pagos"("deleted_at");

-- CreateIndex
CREATE INDEX "cajas_estado_idx" ON "public"."cajas"("estado");

-- CreateIndex
CREATE INDEX "cajas_deleted_at_idx" ON "public"."cajas"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cajas_sucursal_id_codigo_key" ON "public"."cajas"("sucursal_id", "codigo");

-- CreateIndex
CREATE INDEX "apertura_caja_caja_id_estado_idx" ON "public"."apertura_caja"("caja_id", "estado");

-- CreateIndex
CREATE INDEX "apertura_caja_usuario_id_fecha_apertura_idx" ON "public"."apertura_caja"("usuario_id", "fecha_apertura");

-- CreateIndex
CREATE INDEX "apertura_caja_deleted_at_idx" ON "public"."apertura_caja"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_caja_apertura_caja_id_key" ON "public"."cierre_caja"("apertura_caja_id");

-- CreateIndex
CREATE INDEX "cierre_caja_usuario_id_fecha_cierre_idx" ON "public"."cierre_caja"("usuario_id", "fecha_cierre");

-- CreateIndex
CREATE INDEX "cierre_caja_deleted_at_idx" ON "public"."cierre_caja"("deleted_at");

-- CreateIndex
CREATE INDEX "movimientos_caja_apertura_caja_id_fecha_movimiento_idx" ON "public"."movimientos_caja"("apertura_caja_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_caja_forma_pago_id_idx" ON "public"."movimientos_caja"("forma_pago_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_venta_pago_id_idx" ON "public"."movimientos_caja"("venta_pago_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_deleted_at_idx" ON "public"."movimientos_caja"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_movimiento_caja_id_key" ON "public"."ingresos"("movimiento_caja_id");

-- CreateIndex
CREATE INDEX "ingresos_concepto_idx" ON "public"."ingresos"("concepto");

-- CreateIndex
CREATE INDEX "ingresos_deleted_at_idx" ON "public"."ingresos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "egresos_movimiento_caja_id_key" ON "public"."egresos"("movimiento_caja_id");

-- CreateIndex
CREATE INDEX "egresos_concepto_idx" ON "public"."egresos"("concepto");

-- CreateIndex
CREATE INDEX "egresos_deleted_at_idx" ON "public"."egresos"("deleted_at");

-- CreateIndex
CREATE INDEX "configuracion_clave_idx" ON "public"."configuracion"("clave");

-- CreateIndex
CREATE INDEX "configuracion_deleted_at_idx" ON "public"."configuracion"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_empresa_id_sucursal_id_ambito_clave_key" ON "public"."configuracion"("empresa_id", "sucursal_id", "ambito", "clave");

-- CreateIndex
CREATE INDEX "series_documentos_tipo_comprobante_activo_idx" ON "public"."series_documentos"("tipo_comprobante", "activo");

-- CreateIndex
CREATE INDEX "series_documentos_deleted_at_idx" ON "public"."series_documentos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "series_documentos_empresa_id_sucursal_id_tipo_comprobante_s_key" ON "public"."series_documentos"("empresa_id", "sucursal_id", "tipo_comprobante", "serie");

-- CreateIndex
CREATE INDEX "impuestos_tipo_activo_idx" ON "public"."impuestos"("tipo", "activo");

-- CreateIndex
CREATE INDEX "impuestos_deleted_at_idx" ON "public"."impuestos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "impuestos_empresa_id_codigo_key" ON "public"."impuestos"("empresa_id", "codigo");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_fecha_evento_idx" ON "public"."auditoria"("usuario_id", "fecha_evento");

-- CreateIndex
CREATE INDEX "auditoria_tabla_fecha_evento_idx" ON "public"."auditoria"("tabla", "fecha_evento");

-- CreateIndex
CREATE INDEX "auditoria_registro_id_idx" ON "public"."auditoria"("registro_id");

-- CreateIndex
CREATE INDEX "auditoria_deleted_at_idx" ON "public"."auditoria"("deleted_at");

-- AddForeignKey
ALTER TABLE "public"."empresas" ADD CONSTRAINT "empresas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresas" ADD CONSTRAINT "empresas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sucursales" ADD CONSTRAINT "sucursales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sucursales" ADD CONSTRAINT "sucursales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sucursales" ADD CONSTRAINT "sucursales_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuarios" ADD CONSTRAINT "usuarios_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuarios" ADD CONSTRAINT "usuarios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuarios" ADD CONSTRAINT "usuarios_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permisos" ADD CONSTRAINT "permisos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."permisos" ADD CONSTRAINT "permisos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_rol" ADD CONSTRAINT "usuario_rol_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_rol" ADD CONSTRAINT "usuario_rol_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rol_permiso" ADD CONSTRAINT "rol_permiso_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rol_permiso" ADD CONSTRAINT "rol_permiso_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categorias" ADD CONSTRAINT "categorias_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categorias" ADD CONSTRAINT "categorias_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."laboratorios" ADD CONSTRAINT "laboratorios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."laboratorios" ADD CONSTRAINT "laboratorios_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."presentaciones" ADD CONSTRAINT "presentaciones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."presentaciones" ADD CONSTRAINT "presentaciones_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."unidades_medida" ADD CONSTRAINT "unidades_medida_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."unidades_medida" ADD CONSTRAINT "unidades_medida_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."principios_activos" ADD CONSTRAINT "principios_activos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."principios_activos" ADD CONSTRAINT "principios_activos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_laboratorio_id_fkey" FOREIGN KEY ("laboratorio_id") REFERENCES "public"."laboratorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_unidad_medida_id_fkey" FOREIGN KEY ("unidad_medida_id") REFERENCES "public"."unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."productos" ADD CONSTRAINT "productos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_principio_activo" ADD CONSTRAINT "producto_principio_activo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_principio_activo" ADD CONSTRAINT "producto_principio_activo_principio_activo_id_fkey" FOREIGN KEY ("principio_activo_id") REFERENCES "public"."principios_activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_principio_activo" ADD CONSTRAINT "producto_principio_activo_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_principio_activo" ADD CONSTRAINT "producto_principio_activo_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_impuesto" ADD CONSTRAINT "producto_impuesto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_impuesto" ADD CONSTRAINT "producto_impuesto_impuesto_id_fkey" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_impuesto" ADD CONSTRAINT "producto_impuesto_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."producto_impuesto" ADD CONSTRAINT "producto_impuesto_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario" ADD CONSTRAINT "inventario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario" ADD CONSTRAINT "inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario" ADD CONSTRAINT "inventario_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario" ADD CONSTRAINT "inventario_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_detalle_compra_id_fkey" FOREIGN KEY ("detalle_compra_id") REFERENCES "public"."detalle_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motivos_movimiento" ADD CONSTRAINT "motivos_movimiento_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motivos_movimiento" ADD CONSTRAINT "motivos_movimiento_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_motivo_id_fkey" FOREIGN KEY ("motivo_id") REFERENCES "public"."motivos_movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_detalle_compra_id_fkey" FOREIGN KEY ("detalle_compra_id") REFERENCES "public"."detalle_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "public"."detalle_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_detalle_venta_lote_id_fkey" FOREIGN KEY ("detalle_venta_lote_id") REFERENCES "public"."detalle_venta_lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proveedores" ADD CONSTRAINT "proveedores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proveedores" ADD CONSTRAINT "proveedores_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compras" ADD CONSTRAINT "compras_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compras" ADD CONSTRAINT "compras_usuario_responsable_id_fkey" FOREIGN KEY ("usuario_responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compras" ADD CONSTRAINT "compras_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compras" ADD CONSTRAINT "compras_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_compra" ADD CONSTRAINT "detalle_compra_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_compra" ADD CONSTRAINT "detalle_compra_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_compra" ADD CONSTRAINT "detalle_compra_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_compra" ADD CONSTRAINT "detalle_compra_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "clientes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ventas" ADD CONSTRAINT "ventas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ventas" ADD CONSTRAINT "ventas_usuario_responsable_id_fkey" FOREIGN KEY ("usuario_responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ventas" ADD CONSTRAINT "ventas_serie_documento_id_fkey" FOREIGN KEY ("serie_documento_id") REFERENCES "public"."series_documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ventas" ADD CONSTRAINT "ventas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ventas" ADD CONSTRAINT "ventas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta" ADD CONSTRAINT "detalle_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta" ADD CONSTRAINT "detalle_venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta" ADD CONSTRAINT "detalle_venta_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta" ADD CONSTRAINT "detalle_venta_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta_lote" ADD CONSTRAINT "detalle_venta_lote_detalle_venta_id_fkey" FOREIGN KEY ("detalle_venta_id") REFERENCES "public"."detalle_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta_lote" ADD CONSTRAINT "detalle_venta_lote_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta_lote" ADD CONSTRAINT "detalle_venta_lote_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_venta_lote" ADD CONSTRAINT "detalle_venta_lote_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."formas_pago" ADD CONSTRAINT "formas_pago_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."formas_pago" ADD CONSTRAINT "formas_pago_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venta_pagos" ADD CONSTRAINT "venta_pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venta_pagos" ADD CONSTRAINT "venta_pagos_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "public"."formas_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venta_pagos" ADD CONSTRAINT "venta_pagos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venta_pagos" ADD CONSTRAINT "venta_pagos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cajas" ADD CONSTRAINT "cajas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cajas" ADD CONSTRAINT "cajas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cajas" ADD CONSTRAINT "cajas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apertura_caja" ADD CONSTRAINT "apertura_caja_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apertura_caja" ADD CONSTRAINT "apertura_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apertura_caja" ADD CONSTRAINT "apertura_caja_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apertura_caja" ADD CONSTRAINT "apertura_caja_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierre_caja" ADD CONSTRAINT "cierre_caja_apertura_caja_id_fkey" FOREIGN KEY ("apertura_caja_id") REFERENCES "public"."apertura_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierre_caja" ADD CONSTRAINT "cierre_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierre_caja" ADD CONSTRAINT "cierre_caja_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierre_caja" ADD CONSTRAINT "cierre_caja_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_caja" ADD CONSTRAINT "movimientos_caja_apertura_caja_id_fkey" FOREIGN KEY ("apertura_caja_id") REFERENCES "public"."apertura_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_caja" ADD CONSTRAINT "movimientos_caja_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "public"."formas_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_caja" ADD CONSTRAINT "movimientos_caja_venta_pago_id_fkey" FOREIGN KEY ("venta_pago_id") REFERENCES "public"."venta_pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_caja" ADD CONSTRAINT "movimientos_caja_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimientos_caja" ADD CONSTRAINT "movimientos_caja_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingresos" ADD CONSTRAINT "ingresos_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "public"."movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingresos" ADD CONSTRAINT "ingresos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingresos" ADD CONSTRAINT "ingresos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egresos" ADD CONSTRAINT "egresos_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "public"."movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egresos" ADD CONSTRAINT "egresos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."egresos" ADD CONSTRAINT "egresos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion" ADD CONSTRAINT "configuracion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion" ADD CONSTRAINT "configuracion_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion" ADD CONSTRAINT "configuracion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuracion" ADD CONSTRAINT "configuracion_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."series_documentos" ADD CONSTRAINT "series_documentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."series_documentos" ADD CONSTRAINT "series_documentos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."series_documentos" ADD CONSTRAINT "series_documentos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."series_documentos" ADD CONSTRAINT "series_documentos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."impuestos" ADD CONSTRAINT "impuestos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."impuestos" ADD CONSTRAINT "impuestos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."impuestos" ADD CONSTRAINT "impuestos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditoria" ADD CONSTRAINT "auditoria_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditoria" ADD CONSTRAINT "auditoria_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
