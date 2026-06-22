import { Button, Heading, Html, Text } from 'react-email'

export interface WelcomeEmailProps {
  name: string
  verifyUrl: string
}

export function WelcomeEmail({ name, verifyUrl }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Heading>Welcome, {name}!</Heading>
      <Text>Thanks for signing up. Confirm your email to get started.</Text>
      <Button href={verifyUrl}>Verify my email</Button>
    </Html>
  )
}
