import { EmailBodyText, EmailButton, EmailHeading, EmailLayout } from '~/emails/components'

export function VerifyEmail({ name, url }: { name?: string; url: string }) {
  return (
    <EmailLayout preview="Confirm your email address">
      <EmailHeading>Confirm your email address</EmailHeading>
      <EmailBodyText>
        {name ? `Hi ${name}, ` : ''}confirm your email address to finish setting up your account.
      </EmailBodyText>
      <EmailButton href={url}>Confirm email</EmailButton>
    </EmailLayout>
  )
}

export default VerifyEmail
