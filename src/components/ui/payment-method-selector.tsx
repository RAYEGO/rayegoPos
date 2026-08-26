import * as React from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  buildPaymentCategoryGroups,
  labelForCategory,
  type PaymentCategory,
  type PaymentMethodOption,
} from '@/lib/payment-methods'

export type PaymentMethodSelectProps<T extends PaymentMethodOption> = {
  value: string
  onChange: (formaPagoId: string) => void
  methods: T[]
  label?: string
  placeholderCategory?: string
  placeholderSubmethod?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
  error?: string
  submethodLabel?: string
}

export function PaymentMethodTwoLevelSelect<T extends PaymentMethodOption>(
  props: PaymentMethodSelectProps<T>,
) {
  const {
    value,
    onChange,
    methods,
    label = 'Medio de pago',
    placeholderCategory = 'Selecciona una categoría',
    placeholderSubmethod = 'Selecciona un submedio',
    disabled,
    required,
    className,
    id,
    error,
    submethodLabel = 'Medio digital',
  } = props

  const groups = React.useMemo(() => buildPaymentCategoryGroups(methods), [methods])

  const selectedMethod = React.useMemo(
    () => methods.find((m) => m.id === value) ?? null,
    [methods, value],
  )

  const [pendingCategory, setPendingCategory] = React.useState<PaymentCategory | ''>('')

  React.useEffect(() => {
    if (selectedMethod) {
      setPendingCategory(selectedMethod.category)
    }
  }, [selectedMethod])

  const selectedCategory: PaymentCategory | '' = selectedMethod
    ? selectedMethod.category
    : pendingCategory

  const handleCategoryChange = (categoryValue: string) => {
    if (!categoryValue) {
      setPendingCategory('')
      onChange('')
      return
    }
    const category = categoryValue as PaymentCategory
    if (!groups.order.includes(category)) {
      setPendingCategory('')
      onChange('')
      return
    }
    const categoryMethods = groups.groups[category]
    setPendingCategory(category)
    if (category === 'DIGITAL') {
      if (selectedMethod?.category === 'DIGITAL' && categoryMethods.some((m) => m.id === selectedMethod.id)) {
        onChange(selectedMethod.id)
      } else {
        onChange('')
      }
    } else {
      onChange(categoryMethods[0]?.id ?? '')
    }
  }

  const handleSubmethodChange = (methodId: string) => {
    onChange(methodId || '')
  }

  const categoryValue = selectedCategory || ''

  const digitalMethods = React.useMemo(() => {
    return groups.groups.DIGITAL ?? []
  }, [groups])

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <label
          htmlFor={id ? `${id}-category` : undefined}
          className="text-sm font-medium"
        >
          {label}
          {required && <span className="ml-1 text-rose-600">*</span>}
        </label>
        <Select
          value={categoryValue}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={id ? `${id}-category` : undefined}
            className={cn(error && 'border-rose-500 focus-visible:ring-rose-500')}
          >
            <SelectValue placeholder={placeholderCategory} />
          </SelectTrigger>
          <SelectContent>
            {groups.order.map((category) => (
              <SelectItem key={category} value={category}>
                {labelForCategory(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCategory === 'DIGITAL' && (
        <div className="space-y-2 rounded-xl border border-muted bg-muted/20 p-3 pl-4">
          <label
            htmlFor={id ? `${id}-submethod` : undefined}
            className="text-sm font-medium"
          >
            {submethodLabel}
            {required && <span className="ml-1 text-rose-600">*</span>}
          </label>
          <Select
            value={selectedMethod?.category === 'DIGITAL' ? value : ''}
            onValueChange={handleSubmethodChange}
            disabled={disabled}
          >
            <SelectTrigger id={id ? `${id}-submethod` : undefined}>
              <SelectValue placeholder={placeholderSubmethod} />
            </SelectTrigger>
            <SelectContent>
              {digitalMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!digitalMethods.length && (
            <p className="text-xs text-muted-foreground">
              No hay métodos digitales configurados.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}

type FormPaymentMethodProps<
  TFieldValues extends FieldValues,
  TOption extends PaymentMethodOption,
> = {
  control: Control<TFieldValues>
  name: Path<TFieldValues>
  methods: TOption[]
  label?: string
  placeholderCategory?: string
  placeholderSubmethod?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
  submethodLabel?: string
}

export function FormPaymentMethodTwoLevelSelect<
  TFieldValues extends FieldValues,
  TOption extends PaymentMethodOption,
>(props: FormPaymentMethodProps<TFieldValues, TOption>) {
  const {
    control,
    name,
    methods,
    label,
    placeholderCategory,
    placeholderSubmethod,
    disabled,
    required,
    className,
    id,
    submethodLabel,
  } = props

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <PaymentMethodTwoLevelSelect
          value={String(field.value ?? '')}
          onChange={(v) => field.onChange(v)}
          methods={methods}
          label={label}
          placeholderCategory={placeholderCategory}
          placeholderSubmethod={placeholderSubmethod}
          disabled={disabled || field.disabled}
          required={required}
          className={className}
          id={id}
          submethodLabel={submethodLabel}
          error={fieldState.error?.message}
        />
      )}
    />
  )
}
