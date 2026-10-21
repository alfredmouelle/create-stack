import { Link } from 'rasengan'
import { AuthCard } from '~/features/auth/auth-card'
import { ForgotPasswordForm } from '~/features/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Enter your email to receive a reset link."
      footer={
        <Link
          className="cursor-pointer text-primary hover:text-primary/80 hover:underline"
          to="/auth/sign-in"
        >
          Back to sign in
        </Link>
      }
      title="Forgot password"
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}

ForgotPasswordPage.metadata = { title: 'Forgot password' }
