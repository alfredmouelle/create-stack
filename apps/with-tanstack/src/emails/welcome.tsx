import { EmailBodyText, EmailButton, EmailHeading, EmailLayout } from '@alfredmouelle/email-kit'

interface WelcomeEmailProps {
  name: string
  loginUrl: string
}

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome aboard.">
      <EmailHeading kicker="Welcome">Glad you're here, {name}.</EmailHeading>
      <EmailBodyText>Your account is ready. Jump back in whenever you like.</EmailBodyText>
      <EmailButton href={loginUrl}>Open the app →</EmailButton>
    </EmailLayout>
  )
}
