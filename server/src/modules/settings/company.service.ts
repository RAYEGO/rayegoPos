import { Prisma } from '@prisma/client'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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

type R2Config = {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
  region: string
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

function getR2Config(): R2Config {
  const endpoint = process.env.R2_ENDPOINT?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET_COMPANY_ASSETS?.trim()
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim()
  const region = process.env.R2_REGION?.trim() || 'auto'

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw createHttpError(
      500,
      [
        'Cloudflare R2 no está configurado.',
        'Defina R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_COMPANY_ASSETS y R2_PUBLIC_BASE_URL.',
      ].join(' '),
    )
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: normalizeBaseUrl(publicBaseUrl),
    region,
  }
}

let r2Client: S3Client | null = null

function getR2Client(config: R2Config) {
  if (r2Client) return r2Client
  r2Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  })
  return r2Client
}

function normalizeImageExtension(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/jpeg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  return null
}

function extractR2ObjectKey(logoUrl: string, publicBaseUrl: string) {
  const base = normalizeBaseUrl(publicBaseUrl)
  const normalizedLogoUrl = logoUrl.trim()

  if (!normalizedLogoUrl.startsWith(`${base}/`)) {
    return null
  }

  const key = normalizedLogoUrl.slice(base.length + 1)
  if (!key) return null
  return decodeURIComponent(key)
}

export async function uploadCompanyLogo(payload: UploadCompanyLogoPayload, request: FastifyRequest) {
  assertAdmin(request)
  const { companyId, userId } = await requireBranchAuthContext(request)
  const r2Config = getR2Config()
  const client = getR2Client(r2Config)

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

  const bucket = r2Config.bucket
  const objectKey = `empresas/${companyId}/logo/logo-${Date.now()}.${extension}`
  const publicUrl = `${r2Config.publicBaseUrl}/${objectKey}`

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: Buffer.from(bytes),
        ContentType: payload.mimeType,
      }),
    )
  } catch (error) {
    throw createHttpError(
      502,
      `No se pudo subir el logo a Cloudflare R2. ${error instanceof Error ? error.message : ''}`.trim(),
    )
  }

  let updated:
    | {
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
      }
    | null = null

  try {
    updated = await prisma.empresa.update({
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
  } catch (error) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      )
    } catch {
    }

    throw error
  }

  const previousKey = existing.logoUrl
    ? extractR2ObjectKey(existing.logoUrl, r2Config.publicBaseUrl)
    : null

  if (previousKey && previousKey !== objectKey) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: previousKey,
        }),
      )
    } catch {
    }
  }

  return { company: mapCompany(updated) }
}

export async function deleteCompanyLogo(request: FastifyRequest) {
  assertAdmin(request)
  const { companyId, userId } = await requireBranchAuthContext(request)
  const r2Config = getR2Config()
  const client = getR2Client(r2Config)

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

  const previousKey = existing.logoUrl
    ? extractR2ObjectKey(existing.logoUrl, r2Config.publicBaseUrl)
    : null

  if (previousKey) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: r2Config.bucket,
          Key: previousKey,
        }),
      )
    } catch {
    }
  }

  return { company: mapCompany(updated) }
}
