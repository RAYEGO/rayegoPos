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

export type UploadCompanyLogoPayload = {
  fileName: string
  mimeType: string
  base64: string
}

export type UploadCompanyLogoResponse = {
  company: CompanyProfile
}

export type DeleteCompanyLogoResponse = {
  company: CompanyProfile
}
