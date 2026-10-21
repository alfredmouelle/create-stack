import { Navigate } from 'rasengan'

export default function AuthIndex() {
  return <Navigate replace to="/auth/sign-in" />
}

AuthIndex.metadata = { title: 'App' }
