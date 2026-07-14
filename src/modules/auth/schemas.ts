import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Ingresa un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  remember: z.boolean(),
})

export const forgotPasswordSchema = z.object({
  email: z.email('Ingresa un correo válido.'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirma la nueva contraseña.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

export type LoginSchemaValues = z.infer<typeof loginSchema>
export type ForgotPasswordSchemaValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordSchemaValues = z.infer<typeof resetPasswordSchema>

