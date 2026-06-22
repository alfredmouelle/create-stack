import { EmailBodyText, EmailButton, EmailHeading, EmailLayout } from '~/emails/components'

export function ResetPasswordEmail({ name, url }: { name?: string; url: string }) {
  return (
    <EmailLayout preview="Reset your password">
      <EmailHeading>Reset your password</EmailHeading>
      <EmailBodyText>
        {name ? `Hi ${name}, ` : ''}we received a request to reset your password. This link expires
        soon.
      </EmailBodyText>
      <EmailButton href={url}>Reset password</EmailButton>
    </EmailLayout>
  )
}

export default ResetPasswordEmail
