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
import { GoogleButton } from '~/features/auth/google-button'

import { useSignUpForm } from './use-sign-up-form'

export function SignUpForm() {
  const { form, formError, onSubmit } = useSignUpForm()

  return (
    <Form {...form}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <GoogleButton label="Sign up with Google" />

        {Boolean(formError) && <FormAlert>{formError}</FormAlert>}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Your name" {...field} />
              </FormControl>
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
              <FormControl>
                <Input autoComplete="email" placeholder="you@example.com" type="email" {...field} />
              </FormControl>
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
              <FormControl>
                <Input
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  type="password"
                  {...field}
                />
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
          {form.formState.isSubmitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </Form>
  )
}
