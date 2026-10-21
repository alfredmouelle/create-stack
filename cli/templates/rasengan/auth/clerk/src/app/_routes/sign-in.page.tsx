import { SignIn } from '@clerk/react'

export default function SignInPage() {
  return <main className="flex min-h-svh items-center justify-center p-8"><SignIn routing="hash" /></main>
}
