import { valibotResolver } from '@hookform/resolvers/valibot'
import { useNavigate } from 'rasengan'
import { useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { type ResetPasswordInput, ResetPasswordSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function useResetPasswordForm({ token }: { readonly token?: string | undefined }): {
  readonly form: UseFormReturn<ResetPasswordInput>
  readonly formError: string | null
  readonly onSubmit: ReturnType<UseFormReturn<ResetPasswordInput>['handleSubmit']>
} {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ResetPasswordInput>({
    resolver: valibotResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (token === undefined || token === '') return
    setFormError(null)
    const { error } = await authClient.resetPassword({ newPassword: values.password, token })
    if (error) {
      setFormError(error.message ?? 'Could not reset password.')
      return
    }
    await navigate('/auth/sign-in')
  })
  return { form, formError, onSubmit }
}
