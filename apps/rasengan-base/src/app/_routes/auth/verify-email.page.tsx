import { Link, useSearchParams } from 'rasengan'
import { AuthCard } from '~/features/auth/auth-card'
import { VerifyEmailActions } from '~/features/auth/verify-email-actions'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? undefined

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
          to="/auth/sign-in"
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

VerifyEmailPage.metadata = { title: 'Confirm your email' }
