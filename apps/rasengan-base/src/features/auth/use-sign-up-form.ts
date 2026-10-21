import { valibotResolver } from '@hookform/resolvers/valibot'
import { useNavigate } from 'rasengan'
import { useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { type SignUpInput, SignUpSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function useSignUpForm(): {
  readonly form: UseFormReturn<SignUpInput>
  readonly formError: string | null
  readonly onSubmit: ReturnType<UseFormReturn<SignUpInput>['handleSubmit']>
} {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SignUpInput>({
    resolver: valibotResolver(SignUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: '/',
    })

    if (!error) {
      void navigate(`/auth/verify-email?email=${encodeURIComponent(values.email)}`)
      return
    }

    setFormError(
      error.code === 'USER_ALREADY_EXISTS'
        ? 'An account already exists with this email.'
        : (error.message ?? 'Could not sign up. Try again.'),
    )
  })

  return { form, formError, onSubmit }
}
