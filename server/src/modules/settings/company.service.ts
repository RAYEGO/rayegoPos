import { Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { requireBranchAuthContext } from '../../lib/auth.js'

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function assertAdmin(request: FastifyRequest) {
  const roles = request.auth?.roles ?? []
  if (!roles.includes('ADMIN')) {
    throw createHttpError(403, 'No tienes permisos para acceder a esta sección.')
  }
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (typeof value === 'number') {
    return value
  }
  return Number(value ?? 0)
}

function toNullableTrimmed(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export type CompanyProfile = {
  id: string
  logoUrl: string | null
  operationMode: 'IMPLEMENTACION' | 'PRODUCCION'
  razonSocial: string
  nombreComercial: string | null
  ruc: string
  direccionFiscal: string | null
  telefono: string | null
  email: string | null
  moneda: string
  igvPorDefecto: number
  activo: boolean
  createdAt: string
  updatedAt: string
}

function mapCompany(company: {
  id: string
  logoUrl: string | null
  modoOperacion: 'IMPLEMENTACION' | 'PRODUCCION'
  razonSocial: string
  nombreComercial: string | null
  numeroDocumento: string
  direccion: string | null
  telefono: string | null
  email: string | null
  monedaBase: string
  igvPorDefecto: Prisma.Decimal | number
  activo: boolean
  createdAt: Date
  updatedAt: Date
}): CompanyProfile {
  return {
    id: company.id,
    logoUrl: company.logoUrl,
    operationMode: company.modoOperacion,
    razonSocial: company.razonSocial,
    nombreComercial: company.nombreComercial,
    ruc: company.numeroDocumento,
    direccionFiscal: company.direccion,
    telefono: company.telefono,
    email: company.email,
    moneda: company.monedaBase,
    igvPorDefecto: decimalToNumber(company.igvPorDefecto),
    activo: company.activo,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  }
}

export async function getCompanyProfile(request: FastifyRequest) {
  assertAdmin(request)
  const { companyId } = await requireBranchAuthContext(request)

  const company = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      logoUrl: true,
      modoOperacion: true,
      razonSocial: true,
      nombreComercial: true,
      numeroDocumento: true,
      direccion: true,
      telefono: true,
      email: true,
      monedaBase: true,
      igvPorDefecto: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!company) {
    throw createHttpError(404, 'La empresa no está disponible.')
  }

  return { company: mapCompany(company) }
}

export type UpdateCompanyProfilePayload = {
  logoUrl?: string | null
  razonSocial: string
  nombreComercial?: string | null
  ruc: string
  direccionFiscal?: string | null
  telefono?: string | null
  email?: string | null
  moneda: string
  igvPorDefecto: number
  activo: boolean
}

export async function updateCompanyProfile(
  payload: UpdateCompanyProfilePayload,
  request: FastifyRequest,
) {
  assertAdmin(request)
  const { companyId, userId } = await requireBranchAuthContext(request)

  const existing = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  })

  if (!existing) {
    throw createHttpError(404, 'La empresa no está disponible.')
  }

  const updated = await prisma.empresa.update({
    where: {
      id: companyId,
    },
    data: {
      logoUrl: payload.logoUrl ?? null,
      razonSocial: payload.razonSocial.trim(),
      nombreComercial: toNullableTrimmed(payload.nombreComercial),
      numeroDocumento: payload.ruc.trim(),
      direccion: toNullableTrimmed(payload.direccionFiscal),
      telefono: toNullableTrimmed(payload.telefono),
      email: toNullableTrimmed(payload.email),
      monedaBase: payload.moneda.trim().toUpperCase(),
      igvPorDefecto: new Prisma.Decimal(payload.igvPorDefecto.toFixed(4)),
      activo: payload.activo,
      updatedById: userId,
    },
    select: {
      id: true,
      logoUrl: true,
      modoOperacion: true,
      razonSocial: true,
      nombreComercial: true,
      numeroDocumento: true,
      direccion: true,
      telefono: true,
      email: true,
      monedaBase: true,
      igvPorDefecto: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return { company: mapCompany(updated) }
}

export type UpdateCompanyOperationModePayload = {
  operationMode: 'PRODUCCION'
}

export async function updateCompanyOperationMode(
  payload: UpdateCompanyOperationModePayload,
  request: FastifyRequest,
) {
  assertAdmin(request)
  const { companyId, userId } = await requireBranchAuthContext(request)

  const existing = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      modoOperacion: true,
    },
  })

  if (!existing) {
    throw createHttpError(404, 'La empresa no está disponible.')
  }

  if (existing.modoOperacion === 'PRODUCCION') {
    throw createHttpError(409, 'La empresa ya se encuentra en modo PRODUCCIÓN.')
  }

  if (payload.operationMode !== 'PRODUCCION') {
    throw createHttpError(400, 'El modo de operación indicado no es válido.')
  }

  const updated = await prisma.empresa.update({
    where: {
      id: companyId,
    },
    data: {
      modoOperacion: 'PRODUCCION',
      updatedById: userId,
    },
    select: {
      id: true,
      logoUrl: true,
      modoOperacion: true,
      razonSocial: true,
      nombreComercial: true,
      numeroDocumento: true,
      direccion: true,
      telefono: true,
      email: true,
      monedaBase: true,
      igvPorDefecto: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return { company: mapCompany(updated) }
}

type UploadCompanyLogoPayload = {
  fileName: string
  mimeType: string
  base64: string
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceKey) {
    throw createHttpError(
      500,
      'Supabase Storage no está configurado. Defina SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  return { url, serviceKey }
}

function normalizeImageExtension(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/jpeg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  return null
}

function extractStorageObjectPath(logoUrl: string, bucket: string) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = logoUrl.indexOf(marker)
  if (index === -1) return null
  return logoUrl.slice(index + marker.length)
}

async function supabaseStorageRequest({
  url,
  serviceKey,
  method,
  bucket,
  path,
  contentType,
  body,
}: {
  url: string
  serviceKey: string
  method: 'PUT' | 'DELETE'
  bucket: string
  path: string
  contentType?: string
  body?: Uint8Array
}) {
  const endpoint = `${url.replace(/\/$/, '')}/storage/v1/object/${bucket}/${encodeURI(path)}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serviceKey}`,
  }

  if (method === 'PUT') {
    headers['x-upsert'] = 'true'
    if (contentType) {
      headers['Content-Type'] = contentType
    }
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw createHttpError(
      502,
      `No se pudo sincronizar el logo en Supabase Storage. ${errorText || response.statusText}`.trim(),
    )
  }
}

export async function uploadCompanyLogo(payload: UploadCompanyLogoPayload, request: FastifyRequest) {
  assertAdmin(request)
  const { companyId, userId } = await requireBranchAuthContext(request)
  const { url, serviceKey } = getSupabaseConfig()

  const extension = normalizeImageExtension(payload.mimeType)
  if (!extension) {
    throw createHttpError(400, 'Formato de imagen no permitido. Use PNG, JPG, JPEG o WEBP.')
  }

  const cleanBase64 = payload.base64.trim().replace(/^data:[^;]+;base64,/, '')
  let bytes: Uint8Array
  try {
    bytes = Buffer.from(cleanBase64, 'base64')
  } catch {
    throw createHttpError(400, 'No se pudo leer el archivo. Intente nuevamente.')
  }

  if (!bytes.length) {
    throw createHttpError(400, 'El archivo indicado está vacío.')
  }

  const maxBytes = 2 * 1024 * 1024
  if (bytes.length > maxBytes) {
    throw createHttpError(400, 'El archivo excede el tamaño máximo permitido (2 MB).')
  }

  const bucket = 'company-logos'
  const objectPath = `${companyId}/logo.${extension}`
  const publicUrl = `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`

  const existing = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      logoUrl: true,
    },
  })

  if (!existing) {
    throw createHttpError(404, 'La empresa no está disponible.')
  }

  const previousPath = existing.logoUrl
    ? extractStorageObjectPath(existing.logoUrl, bucket)
    : null

  if (previousPath && previousPath !== objectPath) {
    await supabaseStorageRequest({
      url,
      serviceKey,
      method: 'DELETE',
      bucket,
      path: previousPath,
    })
  }

  await supabaseStorageRequest({
    url,
    serviceKey,
    method: 'PUT',
    bucket,
    path: objectPath,
    contentType: payload.mimeType,
    body: bytes,
  })

  const updated = await prisma.empresa.update({
    where: {
      id: companyId,
    },
    data: {
      logoUrl: publicUrl,
      updatedById: userId,
    },
    select: {
      id: true,
      logoUrl: true,
      modoOperacion: true,
      razonSocial: true,
      nombreComercial: true,
      numeroDocumento: true,
      direccion: true,
      telefono: true,
      email: true,
      monedaBase: true,
      igvPorDefecto: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return { company: mapCompany(updated) }
}

export async function deleteCompanyLogo(request: FastifyRequest) {
  assertAdmin(request)
  const { companyId, userId } = await requireBranchAuthContext(request)
  const { url, serviceKey } = getSupabaseConfig()

  const bucket = 'company-logos'
  const existing = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      logoUrl: true,
    },
  })

  if (!existing) {
    throw createHttpError(404, 'La empresa no está disponible.')
  }

  if (existing.logoUrl) {
    const objectPath = extractStorageObjectPath(existing.logoUrl, bucket)
    if (objectPath) {
      await supabaseStorageRequest({
        url,
        serviceKey,
        method: 'DELETE',
        bucket,
        path: objectPath,
      })
    }
  }

  const updated = await prisma.empresa.update({
    where: {
      id: companyId,
    },
    data: {
      logoUrl: null,
      updatedById: userId,
    },
    select: {
      id: true,
      logoUrl: true,
      modoOperacion: true,
      razonSocial: true,
      nombreComercial: true,
      numeroDocumento: true,
      direccion: true,
      telefono: true,
      email: true,
      monedaBase: true,
      igvPorDefecto: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return { company: mapCompany(updated) }
}
