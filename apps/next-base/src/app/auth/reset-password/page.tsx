import Link from 'next/link'
import { AuthCard } from '~/features/auth/auth-card'
import { ResetPasswordForm } from '../_components/reset-password-form'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams
  const validToken = token && error !== 'INVALID_TOKEN' ? token : undefined

  return (
    <AuthCard
      description="Choose a new password for your account."
      footer={
        <Link className="text-foreground hover:underline" href="/auth/forgot-password">
          Request a new link
        </Link>
      }
      title="New password"
    >
      <ResetPasswordForm token={validToken} />
    </AuthCard>
  )
}
