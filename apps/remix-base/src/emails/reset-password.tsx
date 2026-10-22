import { createElement } from 'react'
import {
  EmailBodyText,
  EmailButton,
  EmailFallback,
  EmailHeading,
  EmailLayout,
} from '~/emails/components'
export function ResetPasswordEmail({
  name,
  url,
}: {
  readonly name?: string | undefined
  readonly url: string
}) {
  return createElement(
    EmailLayout,
    {
      preview: 'Reset your password.',
    },
    createElement(
      EmailHeading,
      {
        kicker: 'Security',
      },
      'Reset your password.',
    ),
    createElement(
      EmailBodyText,
      {},
      'Hi',
      name !== undefined && name !== '' ? ` ${name}` : '',
      ', we received a request to reset your password. Click the button below to choose a new one.',
    ),
    createElement(
      EmailBodyText,
      {
        muted: true,
        size: 'sm',
      },
      "If you didn't request this, you can safely ignore this email.",
    ),
    createElement(
      EmailButton,
      {
        href: url,
        variant: 'destructive',
      },
      'Reset my password \u2192',
    ),
    createElement(EmailFallback, {
      url: url,
    }),
  )
}
export default ResetPasswordEmail
