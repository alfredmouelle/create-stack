import type { Handle, RemixNode } from 'remix/component'
import type { AuthField } from '../../client/auth-form.tsx'
import { AuthForm } from '../../client/auth-form.tsx'
import { AuthCard, AuthLayout } from '../../components/auth-layout.tsx'

export type AuthScreen =
  | 'sign-in'
  | 'sign-up'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'

const screens = {
  'sign-in': { title: 'Sign in', description: 'Sign in to your account.', label: 'Sign in' },
  'sign-up': {
    title: 'Create an account',
    description: 'Create your account.',
    label: 'Create account',
  },
  'forgot-password': {
    title: 'Forgot password',
    description: 'Enter your email to receive a reset link.',
    label: 'Send link',
  },
  'reset-password': {
    title: 'New password',
    description: 'Choose a new password for your account.',
    label: 'Reset password',
  },
  'verify-email': { title: 'Confirm your email', description: '', label: 'Resend link' },
} as const

function field(
  name: string,
  label: string,
  type: AuthField['type'],
  autocomplete: string,
  value = '',
): AuthField {
  return {
    name,
    label,
    type,
    autocomplete,
    value,
    required: true,
    minLength: type === 'password' ? 8 : 1,
    maxLength: type === 'password' ? 128 : 254,
  }
}

function FormAlert(handle: Handle<{ success?: boolean; children: RemixNode }>) {
  return () => (
    <div
      class={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed ${handle.props.success === true ? 'border-accent bg-accent/60 text-accent-foreground' : 'border-destructive/20 bg-destructive/8 text-destructive'}`}
      role="alert"
    >
      <svg
        aria-hidden="true"
        class="mt-0.5 size-4 shrink-0"
        fill="none"
        height="24"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" />
        {handle.props.success === true ? (
          <path d="m9 12 2 2 4-4" />
        ) : (
          <>
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </>
        )}
      </svg>
      <span>{handle.props.children}</span>
    </div>
  )
}

function Footer(handle: Handle<{ screen: AuthScreen }>) {
  return () => {
    const screen = handle.props.screen
    const linkClass = 'ml-1 cursor-pointer text-primary hover:text-primary/80 hover:underline'
    if (screen === 'sign-in')
      return (
        <>
          No account yet?{' '}
          <a class={linkClass} href="/auth/sign-up">
            Create an account
          </a>
        </>
      )
    if (screen === 'sign-up')
      return (
        <>
          Already have an account?{' '}
          <a class={linkClass} href="/auth/sign-in">
            Sign in
          </a>
        </>
      )
    return (
      <a
        class="cursor-pointer text-primary hover:text-primary/80 hover:underline"
        href={screen === 'reset-password' ? '/auth/forgot-password' : '/auth/sign-in'}
      >
        {screen === 'reset-password' ? 'Request a new link' : 'Back to sign in'}
      </a>
    )
  }
}

function authFields(screen: AuthScreen, email: string, name: string, token: string): AuthField[] {
  const emailField = field('email', 'Email', 'email', 'email', email)
  const password = field('password', 'Password', 'password', 'new-password')
  switch (screen) {
    case 'sign-up':
      return [field('name', 'Name', 'text', 'name', name), emailField, password]
    case 'sign-in':
      return [emailField, { ...password, autocomplete: 'current-password' }]
    case 'reset-password':
      return [
        { ...password, label: 'New password' },
        field('confirmPassword', 'Confirm password', 'password', 'new-password'),
        { ...field('token', '', 'hidden', 'off', token), minLength: 0 },
      ]
    case 'verify-email':
      return [field('email', '', 'hidden', 'email', email)]
    case 'forgot-password':
      return [emailField]
    default:
      throw new Error('Unknown authentication screen')
  }
}

function authDescription(screen: AuthScreen, email: string): string {
  if (screen !== 'verify-email') return screens[screen].description
  return `A confirmation link was sent${email ? ` to ${email}` : ''}. Click it to activate your account.`
}

function SentNotice(handle: Handle<{ screen: AuthScreen }>) {
  return () => (
    <FormAlert success>
      {handle.props.screen === 'forgot-password'
        ? 'If an account exists for this address, a reset email has just been sent. Check your spam folder.'
        : "Request sent. If your address isn't confirmed yet, you'll get an email. Check your spam folder."}
    </FormAlert>
  )
}

export function AuthPage(
  handle: Handle<{
    screen: AuthScreen
    email: string
    name: string
    token: string
    error: string
    sent: boolean
  }>,
) {
  return () => {
    const { screen, email, name, token, error, sent } = handle.props
    const content = screens[screen]
    const fields = authFields(screen, email, name, token)
    const invalidReset = screen === 'reset-password' && !token
    const hideForm = invalidReset || (sent && screen === 'forgot-password')
    return (
      <AuthLayout>
        <AuthCard
          description={authDescription(screen, email)}
          footer={<Footer screen={screen} />}
          title={content.title}
        >
          <div class="grid gap-4">
            {error ? <FormAlert>{error}</FormAlert> : null}
            {invalidReset ? (
              <FormAlert>
                This reset link is invalid or expired. Please request a new one.
              </FormAlert>
            ) : null}
            {sent ? <SentNotice screen={screen} /> : null}
            {screen === 'verify-email' ? (
              <p class="text-muted-foreground text-sm">
                Didn&apos;t get anything? Check your spam folder or resend the link.
              </p>
            ) : null}
            {hideForm ? null : (
              <AuthForm
                action={`/auth/${screen}`}
                disabled={screen === 'verify-email' && !email}
                fields={fields}
                key={screen}
                label={content.label}
              />
            )}
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }
}

export function Dashboard(handle: Handle<{ name: string; email: string }>) {
  return () => (
    <AuthLayout>
      <AuthCard
        description="You are signed in."
        footer={
          <a class="cursor-pointer hover:underline" href="/">
            Back to home
          </a>
        }
        title={`Welcome, ${handle.props.name || 'there'}.`}
      >
        <div class="grid gap-4">
          <p>{handle.props.email}</p>
          <AuthForm action="/auth/sign-out" fields={[]} label="Sign out" />
        </div>
      </AuthCard>
    </AuthLayout>
  )
}
