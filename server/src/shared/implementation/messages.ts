export const IMPLEMENTATION_MESSAGES = {
  SKU_NOT_FOUND: [
    'El SKU indicado no existe en el catálogo de productos.',
    'Primero registre o importe el Catálogo de Productos y luego realice la Carga Inicial de Inventario.',
  ].join('\n\n'),
  PRODUCT_NOT_FOUND: [
    'El producto indicado no existe en el catálogo de productos.',
    'Primero registre o importe el Catálogo de Productos y luego realice la Carga Inicial de Inventario.',
  ].join('\n\n'),
  PRODUCT_ALREADY_EXISTS: [
    'El producto ya existe en el catálogo de productos.',
    'Utilice un registro diferente o actualice el producto existente.',
  ].join('\n\n'),
  SKU_ALREADY_EXISTS: [
    'El SKU ya existe en el catálogo de productos.',
    'Utilice un SKU diferente o actualice el producto existente.',
  ].join('\n\n'),
  LOT_ALREADY_EXISTS: [
    'El lote indicado ya existe para este producto.',
    'La Carga Inicial solo permite registrar lotes nuevos.',
    'Si necesita modificar existencias utilice Ajuste de Stock o registre una Compra.',
  ].join('\n\n'),
  INVALID_PRESENTATION: [
    'La presentación seleccionada no corresponde a la configuración del producto.',
    'Verifique el empaque y conversión configurados en el catálogo de productos.',
  ].join('\n\n'),
  CATEGORY_NOT_FOUND: [
    'La categoría indicada no existe.',
    'Registre o importe previamente la categoría antes de continuar.',
  ].join('\n\n'),
  LABORATORY_NOT_FOUND: [
    'El laboratorio indicado no existe.',
    'Registre o importe previamente el laboratorio antes de continuar.',
  ].join('\n\n'),
  UNIT_NOT_FOUND: [
    'La unidad de medida indicada no existe.',
    'Registre o importe previamente la unidad de medida.',
  ].join('\n\n'),
  PRESENTATION_NOT_FOUND: [
    'La presentación indicada no existe.',
    'Registre o importe previamente la presentación antes de continuar.',
  ].join('\n\n'),
  PACKAGING_MODE_NOT_FOUND: [
    'El modo de empaque indicado no es válido.',
    'Utilice únicamente: SIMPLE o BLISTER.',
  ].join('\n\n'),
  PACKAGE_TYPE_NOT_FOUND: [
    'El tipo de empaque indicado no existe o no es válido.',
    'Verifique el valor antes de continuar.',
  ].join('\n\n'),
  INVALID_PRICE: [
    'El precio indicado no es válido.',
    'Verifique el valor antes de continuar.',
  ].join('\n\n'),
  INVALID_COST: [
    'El costo indicado no es válido.',
    'Verifique el valor antes de continuar.',
  ].join('\n\n'),
  INVALID_CONVERSION: [
    'La configuración de empaque y conversión es inválida.',
    'Verifique los valores antes de continuar.',
  ].join('\n\n'),
  INVALID_REQUIRED_FIELD: [
    'Faltan datos obligatorios para completar la importación.',
    'Complete la información requerida antes de continuar.',
  ].join('\n\n'),
  PRODUCT_INACTIVE: [
    'El producto se encuentra inactivo y no puede recibir inventario.',
    'Active el producto antes de realizar la carga.',
  ].join('\n\n'),
  INVALID_FILE: [
    'Se encontraron errores en el archivo.',
    'Corrija los registros indicados antes de continuar con la importación.',
  ].join('\n\n'),
  IMPORT_SUCCESS: [
    'La importación se completó correctamente.',
    'Revise el resumen antes de continuar.',
  ].join('\n\n'),
  IMPORT_PARTIAL_SUCCESS: [
    'La importación se completó parcialmente.',
    'Revise el detalle de registros omitidos antes de continuar.',
  ].join('\n\n'),
  IMPORT_FAILED: [
    'No se pudo completar la importación.',
    'Revise el archivo e intente nuevamente.',
  ].join('\n\n'),
  MASTER_DELETE_BLOCKED_IN_USE: [
    'No se puede eliminar este registro porque está siendo utilizado por otra entidad del sistema.',
    'Solución: marca el registro como Inactivo.',
  ].join('\n\n'),
} as const

export type ImplementationMessageKey = keyof typeof IMPLEMENTATION_MESSAGES

export function formatImplementationMessage(
  key: ImplementationMessageKey,
  detail?: string,
) {
  const message = IMPLEMENTATION_MESSAGES[key]
  if (!detail) {
    return message
  }

  const normalizedDetail = detail.trim()
  if (!normalizedDetail) {
    return message
  }

  return `${message}\n\n${normalizedDetail}`
}
