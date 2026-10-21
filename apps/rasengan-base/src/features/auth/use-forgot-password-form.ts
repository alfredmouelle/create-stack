import { valibotResolver } from '@hookform/resolvers/valibot'
import { useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { type ForgotPasswordInput, ForgotPasswordSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function useForgotPasswordForm(): {
  readonly form: UseFormReturn<ForgotPasswordInput>
  readonly formError: string | null
  readonly onSubmit: ReturnType<UseFormReturn<ForgotPasswordInput>['handleSubmit']>
  readonly sent: boolean
} {
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const form = useForm<ForgotPasswordInput>({
    resolver: valibotResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: '/auth/reset-password',
    })
    if (error) {
      setFormError(error.message ?? 'Could not send. Try again.')
      return
    }
    setSent(true)
  })

  return { form, formError, onSubmit, sent }
}
