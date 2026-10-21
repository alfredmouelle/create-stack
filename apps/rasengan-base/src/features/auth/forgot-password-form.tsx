import { Button } from '~/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import { Spinner } from '~/components/ui/spinner'
import { FormAlert } from '~/features/auth/form-alert'

import { useForgotPasswordForm } from './use-forgot-password-form'

export function ForgotPasswordForm() {
  const { form, formError, onSubmit, sent } = useForgotPasswordForm()

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
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        {Boolean(formError) && <FormAlert>{formError}</FormAlert>}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input autoComplete="email" placeholder="you@example.com" type="email" {...field} />
              </FormControl>
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
