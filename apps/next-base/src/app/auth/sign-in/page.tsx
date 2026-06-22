import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '~/features/auth/auth-card'
import { getSession } from '~/server/better-auth/server'
import { SignInForm } from '../_components/sign-in-form'

export default async function SignInPage() {
  const session = await getSession()
  if (session) redirect('/')

  return (
    <AuthCard
      description="Sign in to your account."
      footer={
        <>
          No account yet?{' '}
          <Link className="ml-1 text-foreground hover:underline" href="/auth/sign-up">
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
