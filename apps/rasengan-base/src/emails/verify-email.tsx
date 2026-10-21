import {
  EmailBodyText,
  EmailButton,
  EmailFallback,
  EmailHeading,
  EmailLayout,
} from '~/emails/components'

export function VerifyEmail({
  name,
  url,
}: {
  readonly name?: string | undefined
  readonly url: string
}) {
  return (
    <EmailLayout preview="Confirm your email address to activate your account.">
      <EmailHeading kicker="Confirmation">Confirm your address.</EmailHeading>
      <EmailBodyText>
        Hi{name !== undefined && name !== '' ? ` ${name}` : ''}, welcome aboard. Click the button
        below to confirm your email address and activate your account.
      </EmailBodyText>
      <EmailBodyText muted size="sm">
        This link is valid for one hour.
      </EmailBodyText>
      <EmailButton href={url}>Confirm my address →</EmailButton>
      <EmailFallback url={url} />
    </EmailLayout>
  )
}

export default VerifyEmail
