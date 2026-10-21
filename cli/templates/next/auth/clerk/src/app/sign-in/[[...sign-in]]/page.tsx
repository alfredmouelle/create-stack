import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <SignIn />
    </div>
  )
}
