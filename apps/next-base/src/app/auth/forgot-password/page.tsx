import Link from 'next/link'
import { AuthCard } from '~/features/auth/auth-card'
import { ForgotPasswordForm } from '../_components/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Enter your email to receive a reset link."
      footer={
        <Link
          className="cursor-pointer text-primary hover:text-primary/80 hover:underline"
          href="/auth/sign-in"
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
