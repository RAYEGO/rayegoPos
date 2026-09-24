import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Loader, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { customersService } from '@/services/customersService'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import type { CreateCustomerPayload, CustomerItem } from '@/types/customers'
import {
  customerFormSchema,
  defaultFormValues,
  getDocumentInputPlaceholder,
  composeNombreCompletoNatural,
  buildNaturalNamesForStorage,
  toPayload,
  type CustomerFormValues,
} from './customerFormSchema'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'No fue posible completar la operación.'
}

export type CustomerFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialValues?: Partial<CustomerFormValues>
  editingCustomer?: CustomerItem | null
  accessToken: string | null
  tiposDocumento: string[]
  tiposPersona: string[]
  onSuccess?: (item: CustomerItem) => void | Promise<void>
  refreshDashboardCallback?: () => Promise<void>
  disabled?: boolean
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  editingCustomer,
  accessToken,
  tiposDocumento,
  tiposPersona,
  onSuccess,
  refreshDashboardCallback,
  disabled = false,
}: CustomerFormDialogProps) {
  const handleUnauthorized = useHandleUnauthorized('CustomerFormDialog')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultFormValues,
  })

  const formTipoPersona = form.watch('tipoPersona')
  const formTipoDocumento = form.watch('tipoDocumento')
  const formPermitirCredito = form.watch('permitirCredito')

  const documentInputPlaceholder = useMemo(
    () => getDocumentInputPlaceholder(formTipoDocumento),
    [formTipoDocumento],
  )

  useEffect(() => {
    if (!open) return

    if (mode === 'edit' && editingCustomer) {
      const nombreCompletoInicial =
        editingCustomer.tipoPersona === 'NATURAL'
          ? composeNombreCompletoNatural({
              nombres: editingCustomer.nombres,
              apellidos: editingCustomer.apellidos,
            })
          : ''
      form.reset({
        tipoPersona: editingCustomer.tipoPersona,
        tipoDocumento: editingCustomer.tipoDocumento ?? '',
        numeroDocumento: editingCustomer.numeroDocumento ?? '',
        nombres: nombreCompletoInicial,
        apellidos: editingCustomer.apellidos ?? '',
        razonSocial: editingCustomer.razonSocial ?? '',
        email: editingCustomer.email ?? '',
        telefono: editingCustomer.telefono ?? '',
        direccion: editingCustomer.direccion ?? '',
        permitirCredito: editingCustomer.permitirCredito,
        limiteCredito: editingCustomer.limiteCredito,
        ubigeo: editingCustomer.ubigeo ?? '',
        fechaNacimiento: editingCustomer.fechaNacimiento
          ? editingCustomer.fechaNacimiento.slice(0, 10)
          : '',
        observaciones: editingCustomer.observaciones ?? '',
        activo: editingCustomer.activo,
      })
      return
    }

    if (mode === 'create') {
      const merged: CustomerFormValues = {
        ...defaultFormValues,
        tipoPersona: initialValues?.tipoPersona || tiposPersona[0] || 'NATURAL',
        tipoDocumento: initialValues?.tipoDocumento || tiposDocumento[0] || '',
        ...initialValues,
        activo: true,
      }
      if (merged.tipoPersona === 'NATURAL') {
        merged.nombres = composeNombreCompletoNatural({
          nombres: merged.nombres,
          apellidoPaterno: (initialValues as Partial<{ apellidoPaterno: string }> | undefined)
            ?.apellidoPaterno,
          apellidoMaterno: (initialValues as Partial<{ apellidoMaterno: string }> | undefined)
            ?.apellidoMaterno,
          apellidos: merged.apellidos,
        })
      }
      form.reset(merged)
    }
  }, [open, mode, editingCustomer, initialValues, tiposPersona, tiposDocumento, form])

  function handleClose() {
    if (isSubmitting) return
    onOpenChange(false)
    form.reset(defaultFormValues)
  }

  async function handleSubmit(values: CustomerFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    setIsSubmitting(true)

    try {
      const normalized = { ...values }
      if (normalized.tipoPersona !== 'JURIDICA') {
        const rebuild = buildNaturalNamesForStorage(normalized.nombres ?? '')
        normalized.nombres = rebuild.nombres
        normalized.apellidos = rebuild.apellidos || normalized.apellidos || ''
      }

      const payload: CreateCustomerPayload & { activo?: boolean } = toPayload(normalized)

      let savedItem: CustomerItem

      if (mode === 'edit' && editingCustomer) {
        payload.activo = values.activo
        const updateResponse = await customersService.update(accessToken, editingCustomer.id, payload)
        savedItem = updateResponse.item
        toast.success('Cliente actualizado correctamente.')
      } else {
        const createResponse = await customersService.create(accessToken, payload)
        savedItem = createResponse.item
        toast.success('Cliente registrado correctamente.')
      }

      onOpenChange(false)
      form.reset(defaultFormValues)

      if (refreshDashboardCallback) {
        await refreshDashboardCallback()
      }

      if (onSuccess) {
        await onSuccess(savedItem)
      }
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SidePanel open={open} onOpenChange={handleClose}>
      <SidePanelContent className="p-0">
        <form
          className="flex h-full flex-col"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {mode === 'edit' ? 'Editar cliente' : 'Registrar cliente'}
              </p>
              <p className="text-sm text-muted-foreground">
                Registra lo indispensable para vender rápido. Los datos del documento pueden
                completarse automáticamente mediante consulta.
              </p>
            </div>
            <SidePanelClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={isSubmitting}>
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </SidePanelClose>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              <Card className="p-4">
                <p className="font-medium text-foreground">Datos principales</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solo pedimos lo necesario para registrar al cliente en menos de un minuto.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de persona</label>
                    <Controller
                      control={form.control}
                      name="tipoPersona"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={disabled || isSubmitting}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposPersona.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={form.formState.errors.tipoPersona?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de documento</label>
                    <Controller
                      control={form.control}
                      name="tipoDocumento"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={disabled || isSubmitting}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposDocumento.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={form.formState.errors.tipoDocumento?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Número de documento</label>
                    <Input
                      {...form.register('numeroDocumento')}
                      placeholder={documentInputPlaceholder}
                      disabled={disabled || isSubmitting}
                    />
                    <FieldError message={form.formState.errors.numeroDocumento?.message} />
                  </div>

                  {formTipoPersona === 'JURIDICA' ? (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Razón social</label>
                      <Input
                        {...form.register('razonSocial')}
                        placeholder="Empresa SAC"
                        disabled={disabled || isSubmitting}
                      />
                      <FieldError message={form.formState.errors.razonSocial?.message} />
                      <p className="text-xs text-muted-foreground">
                        Los datos del documento pueden completarse automáticamente mediante consulta.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Nombre completo</label>
                      <Input
                        {...form.register('nombres')}
                        placeholder="Juan Pérez Gómez"
                        disabled={disabled || isSubmitting}
                      />
                      <FieldError message={form.formState.errors.nombres?.message} />
                      <p className="text-xs text-muted-foreground">
                        Los datos del documento pueden completarse automáticamente mediante consulta.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono</label>
                    <Input
                      {...form.register('telefono')}
                      placeholder="987654321"
                      disabled={disabled || isSubmitting}
                    />
                    <FieldError message={form.formState.errors.telefono?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Correo</label>
                    <Input
                      {...form.register('email')}
                      type="email"
                      placeholder="cliente@email.com"
                      disabled={disabled || isSubmitting}
                    />
                    <FieldError message={form.formState.errors.email?.message} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Dirección</label>
                    <Input
                      {...form.register('direccion')}
                      placeholder="Dirección (opcional)"
                      disabled={disabled || isSubmitting}
                    />
                    <FieldError message={form.formState.errors.direccion?.message} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Observaciones</label>
                    <Textarea
                      {...form.register('observaciones')}
                      placeholder="Notas (alergias, referencias, contacto, etc.)"
                      className="min-h-24"
                      disabled={disabled || isSubmitting}
                    />
                    <FieldError message={form.formState.errors.observaciones?.message} />
                  </div>
                </div>

                <details className="mt-4 rounded-lg border bg-muted/20 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                    <span>Información adicional</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estos datos no son necesarios para registrar al cliente en caja.
                  </p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fecha de nacimiento</label>
                      <Input
                        {...form.register('fechaNacimiento')}
                        type="date"
                        disabled={disabled || isSubmitting}
                      />
                      <FieldError message={form.formState.errors.fechaNacimiento?.message} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ubigeo</label>
                      <Input
                        {...form.register('ubigeo')}
                        placeholder="150101"
                        disabled={disabled || isSubmitting}
                      />
                      <FieldError message={form.formState.errors.ubigeo?.message} />
                    </div>
                  </div>
                </details>
              </Card>

              <details className="rounded-xl border bg-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">Configuración comercial</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Opcional. Úsalo cuando el cliente maneje crédito.
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </summary>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Permitir crédito</p>
                      <p className="text-xs text-muted-foreground">
                        Disponible próximamente en Ventas
                      </p>
                    </div>
                    <Controller
                      control={form.control}
                      name="permitirCredito"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={disabled || isSubmitting}
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Límite de crédito</label>
                    <Input
                      type="number"
                      step="0.01"
                      disabled={!formPermitirCredito || disabled || isSubmitting}
                      {...form.register('limiteCredito', {
                        setValueAs: (value) => {
                          if (value === '' || value === null || typeof value === 'undefined') {
                            return 0
                          }
                          const next = Number(value)
                          return Number.isFinite(next) ? next : 0
                        },
                      })}
                      placeholder="S/ 0.00"
                    />
                    <FieldError message={form.formState.errors.limiteCredito?.message} />
                  </div>
                </div>
              </details>

              {mode === 'edit' ? (
                <Card className="p-4">
                  <p className="font-medium text-foreground">Estado</p>
                  <div className="mt-3 flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cliente activo</p>
                      <p className="text-xs text-muted-foreground">
                        Disponible para selección en ventas
                      </p>
                    </div>
                    <Controller
                      control={form.control}
                      name="activo"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={disabled || isSubmitting}
                        />
                      )}
                    />
                  </div>
                </Card>
              ) : null}
            </div>
          </div>

          <div className="border-t bg-popover px-6 py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting || disabled}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || disabled}>
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current" />
                    Guardando...
                  </>
                ) : mode === 'edit' ? (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    Guardar cambios
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    Crear cliente
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </SidePanelContent>
    </SidePanel>
  )
}
