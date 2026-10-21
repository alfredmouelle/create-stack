import { valibotResolver } from '@hookform/resolvers/valibot'
import { useNavigate } from 'rasengan'
import { useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { type SignInInput, SignInSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function useSignInForm(): {
  readonly form: UseFormReturn<SignInInput>
  readonly formError: string | null
  readonly onSubmit: ReturnType<UseFormReturn<SignInInput>['handleSubmit']>
} {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SignInInput>({
    resolver: valibotResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })

    if (!error) {
      void navigate('/')
      return
    }

    if (error.code === 'EMAIL_NOT_VERIFIED') {
      void navigate(`/auth/verify-email?email=${encodeURIComponent(values.email)}`)
      return
    }

    setFormError(
      error.code === 'INVALID_EMAIL_OR_PASSWORD'
        ? 'Incorrect email or password.'
        : (error.message ?? 'Could not sign in. Try again.'),
    )
  })

  return { form, formError, onSubmit }
}
