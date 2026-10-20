import Link from 'next/link'
import { AuthCard } from '~/features/auth/auth-card'
import { VerifyEmailActions } from '../_components/verify-email-actions'

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly email?: string }>
}) {
  const { email } = await searchParams

  return (
    <AuthCard
      description={
        <>
          A confirmation link was sent
          {email !== undefined && email !== '' ? ` to ${email}` : ''}. Click it to activate your
          account.
        </>
      }
      footer={
        <Link
          className="cursor-pointer text-primary hover:text-primary/80 hover:underline"
          href="/auth/sign-in"
        >
          Back to sign in
        </Link>
      }
      title="Confirm your email"
    >
      <VerifyEmailActions email={email} />
    </AuthCard>
  )
}
