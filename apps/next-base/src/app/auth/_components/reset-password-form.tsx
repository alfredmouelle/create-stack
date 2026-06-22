'use client'

import { valibotResolver } from '@hookform/resolvers/valibot'
import { Lock } from 'lucide-react'
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
import { type ResetPasswordInput, ResetPasswordSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ResetPasswordInput>({
    resolver: valibotResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return
    setFormError(null)
    const { error } = await authClient.resetPassword({ newPassword: values.password, token })
    if (error) {
      setFormError(error.message ?? 'Could not reset password.')
      return
    }
    router.push('/auth/sign-in')
  })

  if (!token) {
    return <FormAlert>This reset link is invalid or expired. Please request a new one.</FormAlert>
  }

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
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

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <InputGroup className="h-10">
                <InputGroupAddon align="inline-start">
                  <Lock />
                </InputGroupAddon>
                <FormControl>
                  <InputGroupInput autoComplete="new-password" type="password" {...field} />
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
          {form.formState.isSubmitting ? 'Saving…' : 'Reset password'}
        </Button>
      </form>
    </Form>
  )
}
