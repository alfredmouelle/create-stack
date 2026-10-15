import { ResetPasswordEmail } from '~/emails/reset-password'
import { VerifyEmail } from '~/emails/verify-email'
import type { EmailRecipient } from '~/server/email'
import type { Mailer } from '~/server/email/port'

export const sendVerificationEmail = async (params: {
  mailer: Mailer
  to: EmailRecipient
  url: string
}): Promise<void> => {
  await params.mailer.send({
    to: params.to,
    subject: 'Confirm your email address',
    react: <VerifyEmail name={params.to.name} url={params.url} />,
  })
}

export const sendPasswordResetEmail = async (params: {
  mailer: Mailer
  to: EmailRecipient
  url: string
}): Promise<void> => {
  await params.mailer.send({
    to: params.to,
    subject: 'Reset your password',
    react: <ResetPasswordEmail name={params.to.name} url={params.url} />,
  })
}
