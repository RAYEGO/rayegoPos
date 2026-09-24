import { z } from 'zod'
import type { CreateCustomerPayload } from '@/types/customers'

const optionalEmailSchema = z
  .string()
  .max(150, 'Máximo 150 caracteres.')
  .refine((value) => value === '' || /\S+@\S+\.\S+/.test(value), 'Ingresa un correo válido.')

export const customerFormSchema = z
  .object({
    tipoPersona: z.string().min(1, 'Selecciona el tipo de persona.'),
    tipoDocumento: z.string().min(1, 'Selecciona el tipo de documento.'),
    numeroDocumento: z
      .string()
      .trim()
      .min(1, 'Ingresa el número de documento.')
      .max(20, 'Máximo 20 caracteres.'),
    nombres: z.string().max(120).optional(),
    apellidos: z.string().max(120).optional(),
    razonSocial: z.string().max(200).optional(),
    email: optionalEmailSchema,
    telefono: z.string().max(30).optional(),
    direccion: z.string().max(255).optional(),
    permitirCredito: z.boolean(),
    limiteCredito: z.number().min(0),
    ubigeo: z.string().max(6).optional(),
    fechaNacimiento: z.string().optional(),
    observaciones: z.string().max(255).optional(),
    activo: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.tipoPersona === 'JURIDICA') {
      if (!values.razonSocial?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La razón social es obligatoria.',
          path: ['razonSocial'],
        })
      }
      return
    }

    if (!values.nombres?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Los nombres son obligatorios.',
        path: ['nombres'],
      })
    }
  })

export type CustomerFormValues = z.infer<typeof customerFormSchema>

export const defaultFormValues: CustomerFormValues = {
  tipoPersona: '',
  tipoDocumento: '',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  razonSocial: '',
  email: '',
  telefono: '',
  direccion: '',
  permitirCredito: false,
  limiteCredito: 0,
  ubigeo: '',
  fechaNacimiento: '',
  observaciones: '',
  activo: true,
}

export function getDocumentInputPlaceholder(tipoDocumento: string): string {
  if (tipoDocumento === 'RUC') return 'Número de RUC'
  if (tipoDocumento === 'DNI') return 'Número de DNI'
  if (tipoDocumento === 'CE') return 'Carné de extranjería'
  return 'Número de documento'
}

export function composeNombreCompletoNatural(parts: {
  nombres?: string | null | undefined
  apellidoPaterno?: string | null | undefined
  apellidoMaterno?: string | null | undefined
  apellidos?: string | null | undefined
}): string {
  const nombres = parts.nombres?.trim() ?? ''
  let apellidosUsar = parts.apellidos?.trim() ?? ''
  if (!apellidosUsar) {
    const paterno = parts.apellidoPaterno?.trim() ?? ''
    const materno = parts.apellidoMaterno?.trim() ?? ''
    const joined = [paterno, materno].filter((s) => s.length > 0).join(' ')
    apellidosUsar = joined
  }
  const combined = [nombres, apellidosUsar].filter((s) => s.length > 0).join(' ')
  return combined.replace(/\s+/g, ' ').trim()
}

export function buildNaturalNamesForStorage(nombreCompleto: string): {
  nombres: string
  apellidos: string
} {
  const cleaned = nombreCompleto.trim().replace(/\s+/g, ' ')
  if (!cleaned) return { nombres: '', apellidos: '' }
  const tokens = cleaned.split(' ')
  const count = tokens.length
  if (count <= 1) return { nombres: cleaned, apellidos: '' }
  if (count === 2) return { nombres: tokens[0]!, apellidos: tokens[1]! }
  const apellidos = [tokens[count - 2]!, tokens[count - 1]!].join(' ')
  const nombres = tokens.slice(0, count - 2).join(' ')
  return { nombres, apellidos }
}

export function toPayload(values: CustomerFormValues): CreateCustomerPayload {
  const rawCreditLimit = Number.isFinite(values.limiteCredito) ? values.limiteCredito : 0
  const limiteCredito = values.permitirCredito ? Math.max(0, rawCreditLimit) : 0

  return {
    tipoPersona: values.tipoPersona,
    tipoDocumento: values.tipoDocumento?.trim() ? values.tipoDocumento : undefined,
    numeroDocumento: values.numeroDocumento?.trim() || undefined,
    nombres: values.nombres?.trim() || undefined,
    apellidos: values.apellidos?.trim() || undefined,
    razonSocial: values.razonSocial?.trim() || undefined,
    email: values.email?.trim() || undefined,
    telefono: values.telefono?.trim() || undefined,
    direccion: values.direccion?.trim() || undefined,
    permitirCredito: values.permitirCredito,
    limiteCredito: Number(limiteCredito.toFixed(2)),
    ubigeo: values.ubigeo?.trim() || undefined,
    fechaNacimiento: values.fechaNacimiento?.trim() || undefined,
    observaciones: values.observaciones?.trim() || undefined,
  }
}
