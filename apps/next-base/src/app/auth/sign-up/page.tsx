import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '~/features/auth/auth-card'
import { getSession } from '~/server/better-auth/server'
import { SignUpForm } from '../_components/sign-up-form'

export default async function SignUpPage() {
  const session = await getSession()
  if (session) redirect('/')

  return (
    <AuthCard
      description="Create your account."
      footer={
        <>
          Already have an account?{' '}
          <Link className="ml-1 text-foreground hover:underline" href="/auth/sign-in">
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
