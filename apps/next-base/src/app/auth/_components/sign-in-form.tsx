'use client'

import { valibotResolver } from '@hookform/resolvers/valibot'
import { Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '~/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group'
import { FormAlert } from '~/features/auth/form-alert'
import { AuthDivider, GoogleButton } from '~/features/auth/google-button'
import { type SignInInput, SignInSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function SignInForm() {
  const router = useRouter()
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
      router.push('/')
      router.refresh()
      return
    }

    if (error.code === 'EMAIL_NOT_VERIFIED') {
      router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`)
      return
    }

    setFormError(
      error.code === 'INVALID_EMAIL_OR_PASSWORD'
        ? 'Incorrect email or password.'
        : (error.message ?? 'Could not sign in. Try again.'),
    )
  })

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <GoogleButton label="Continue with Google" />
        <AuthDivider />

        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <InputGroup className="h-10">
                <InputGroupAddon align="inline-start">
                  <Mail />
                </InputGroupAddon>
                <FormControl>
                  <InputGroupInput
                    autoComplete="email"
                    placeholder="you@example.com"
                    type="email"
                    {...field}
                  />
                </FormControl>
              </InputGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <InputGroup className="h-10">
                <InputGroupAddon align="inline-start">
                  <Lock />
                </InputGroupAddon>
                <FormControl>
                  <InputGroupInput autoComplete="current-password" type="password" {...field} />
                </FormControl>
              </InputGroup>
              <Link
                className="justify-self-end text-muted-foreground text-xs hover:underline"
                href="/auth/forgot-password"
              >
                Forgot password?
              </Link>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          className="w-full cursor-pointer"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
