import {
  EmailBodyText,
  EmailButton,
  EmailFallback,
  EmailHeading,
  EmailLayout,
} from '../src/index.js'

interface ResetPasswordEmailProps {
  url: string
  name?: string
}

export function ResetPasswordEmail({ url, name }: ResetPasswordEmailProps) {
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

export default function ResetPasswordEmailPreview() {
  return <ResetPasswordEmail name="Marie" url="https://app.test/reset?token=preview-token" />
}
