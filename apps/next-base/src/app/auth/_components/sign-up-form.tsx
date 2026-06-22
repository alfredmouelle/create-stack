'use client'

import { valibotResolver } from '@hookform/resolvers/valibot'
import { Lock, Mail, User } from 'lucide-react'
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
import { type SignUpInput, SignUpSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function SignUpForm() {
  const router = useRouter()
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
      router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`)
      return
    }

    setFormError(
      error.code === 'USER_ALREADY_EXISTS'
        ? 'An account already exists with this email.'
        : (error.message ?? 'Could not sign up. Try again.'),
    )
  })

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <GoogleButton label="Sign up with Google" />
        <AuthDivider />

        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <InputGroup className="h-10">
                <InputGroupAddon align="inline-start">
                  <User />
                </InputGroupAddon>
                <FormControl>
                  <InputGroupInput autoComplete="name" placeholder="Your name" {...field} />
                </FormControl>
              </InputGroup>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  <InputGroupInput
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    type="password"
                    {...field}
                  />
                </FormControl>
              </InputGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          className="w-full cursor-pointer"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </Form>
  )
}
