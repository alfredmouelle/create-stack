import { Link } from 'rasengan'
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

import { useSignInForm } from './use-sign-in-form'

export function SignInForm() {
  const { form, formError, onSubmit } = useSignInForm()

  return (
    <Form {...form}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <GoogleButton label="Continue with Google" />

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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input autoComplete="current-password" type="password" {...field} />
              </FormControl>
              <Link
                className="cursor-pointer justify-self-end text-muted-foreground text-xs hover:underline"
                to="/auth/forgot-password"
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
          {form.formState.isSubmitting ? <Spinner /> : null}
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
