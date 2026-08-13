import {
  EmailBodyText,
  EmailButton,
  EmailFallback,
  EmailHeading,
  EmailLayout,
} from '../src/index.js'

interface VerifyEmailProps {
  url: string
  name?: string
}

export function VerifyEmail({ url, name }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Confirm your email address to activate your account.">
      <EmailHeading kicker="Confirmation">Confirm your address.</EmailHeading>

      <EmailBodyText>
        Hi{name ? ` ${name}` : ''}, welcome aboard. Click the button below to confirm your email
        address and activate your account.
      </EmailBodyText>
      <EmailBodyText muted size="sm">
        This link is valid for one hour.
      </EmailBodyText>

      <EmailButton href={url}>Confirm my address →</EmailButton>
      <EmailFallback url={url} />
    </EmailLayout>
  )
}

export default function VerifyEmailPreview() {
  return <VerifyEmail name="Marie" url="https://app.test/verify?token=preview-token" />
}
