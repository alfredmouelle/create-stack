import {
  EmailBodyText,
  EmailButton,
  EmailFallback,
  EmailHeading,
  EmailLayout,
} from '~/emails/components'

export function ResetPasswordEmail({ name, url }: { name?: string; url: string }) {
  return (
    <EmailLayout preview="Reset your password.">
      <EmailHeading kicker="Security">Reset your password.</EmailHeading>
      <EmailBodyText>
        Hi{name ? ` ${name}` : ''}, we received a request to reset your password. Click the button
        below to choose a new one.
      </EmailBodyText>
      <EmailBodyText muted size="sm">
        If you didn't request this, you can safely ignore this email.
      </EmailBodyText>
      <EmailButton href={url} variant="destructive">
        Reset my password →
      </EmailButton>
      <EmailFallback url={url} />
    </EmailLayout>
  )
}

export default ResetPasswordEmail
