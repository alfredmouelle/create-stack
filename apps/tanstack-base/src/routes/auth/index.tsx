import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/')({
  beforeLoad: () => {
    return redirect({ to: '/auth/sign-in' })
  },
})
