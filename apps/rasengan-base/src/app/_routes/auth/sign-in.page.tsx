import { Link } from 'rasengan'
import { AuthCard } from '~/features/auth/auth-card'
import { SignInForm } from '~/features/auth/sign-in-form'

export default function SignInPage() {
  return (
    <AuthCard
      description="Sign in to your account."
      footer={
        <>
          No account yet?{' '}
          <Link
            className="ml-1 cursor-pointer text-primary hover:text-primary/80 hover:underline"
            to="/auth/sign-up"
          >
            Create an account
          </Link>
        </>
      }
      title="Sign in"
    >
      <SignInForm />
    </AuthCard>
  )
}

SignInPage.metadata = { title: 'Sign in' }
