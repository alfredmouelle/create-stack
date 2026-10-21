import { Link, useSearchParams } from 'rasengan'
import { AuthCard } from '~/features/auth/auth-card'
import { ResetPasswordForm } from '~/features/auth/reset-password-form'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? undefined
  const error = searchParams.get('error')
  const validToken =
    token !== undefined && token !== '' && error !== 'INVALID_TOKEN' ? token : undefined

  return (
    <AuthCard
      description="Choose a new password for your account."
      footer={
        <Link
          className="cursor-pointer text-primary hover:text-primary/80 hover:underline"
          to="/auth/forgot-password"
        >
          Request a new link
        </Link>
      }
      title="New password"
    >
      <ResetPasswordForm token={validToken} />
    </AuthCard>
  )
}

ResetPasswordPage.metadata = { title: 'New password' }
