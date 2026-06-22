import { ResetPasswordEmail } from '~/emails/reset-password';
import { VerifyEmail } from '~/emails/verify-email';
import { type EmailRecipient, sendEmail } from '~/server/email';

export const sendVerificationEmail = (params: {
  to: EmailRecipient;
  url: string;
}): Promise<void> =>
  sendEmail({
    to: params.to,
    subject: 'Confirm your email address',
    template: <VerifyEmail name={params.to.name} url={params.url} />,
  });

export const sendPasswordResetEmail = (params: {
  to: EmailRecipient;
  url: string;
}): Promise<void> =>
  sendEmail({
    to: params.to,
    subject: 'Reset your password',
    template: <ResetPasswordEmail name={params.to.name} url={params.url} />,
  });
