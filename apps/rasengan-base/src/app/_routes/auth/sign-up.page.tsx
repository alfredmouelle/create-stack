import { Link } from 'rasengan'
import { AuthCard } from '~/features/auth/auth-card'
import { SignUpForm } from '~/features/auth/sign-up-form'

export default function SignUpPage() {
  return (
    <AuthCard
      description="Create your account."
      footer={
        <>
          Already have an account?{' '}
          <Link
            className="ml-1 cursor-pointer text-primary hover:text-primary/80 hover:underline"
            to="/auth/sign-in"
          >
            Sign in
          </Link>
        </>
      }
      title="Create an account"
    >
      <SignUpForm />
    </AuthCard>
  )
}

SignUpPage.metadata = { title: 'Create an account' }
