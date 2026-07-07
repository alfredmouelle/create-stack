import { SignUp } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-up/$')({ component: Page })

function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <SignUp />
    </div>
  )
}
