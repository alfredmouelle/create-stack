'use client'

import { valibotResolver } from '@hookform/resolvers/valibot'
import { Mail } from 'lucide-react'
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
import { Spinner } from '~/components/ui/spinner'
import { FormAlert } from '~/features/auth/form-alert'
import { type ForgotPasswordInput, ForgotPasswordSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function ForgotPasswordForm() {
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

  if (sent) {
    return (
      <FormAlert variant="success">
        If an account exists for this address, a reset email has just been sent. Check your spam
        folder.
      </FormAlert>
    )
  }

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={onSubmit}>
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

        <Button
          className="w-full cursor-pointer"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? <Spinner /> : null}
          {form.formState.isSubmitting ? 'Sending…' : 'Send link'}
        </Button>
      </form>
    </Form>
  )
}
