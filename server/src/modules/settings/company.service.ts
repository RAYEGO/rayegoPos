import { Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'

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
  const { companyId } = await getAuthContext(request)

  const company = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      logoUrl: true,
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
  const { companyId, userId } = await getAuthContext(request)

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

