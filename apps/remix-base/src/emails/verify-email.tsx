import { createElement } from 'react'
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
  return createElement(
    EmailLayout,
    {
      preview: 'Confirm your email address to activate your account.',
    },
    createElement(
      EmailHeading,
      {
        kicker: 'Confirmation',
      },
      'Confirm your address.',
    ),
    createElement(
      EmailBodyText,
      {},
      'Hi',
      name !== undefined && name !== '' ? ` ${name}` : '',
      ', welcome aboard. Click the button below to confirm your email address and activate your account.',
    ),
    createElement(
      EmailBodyText,
      {
        muted: true,
        size: 'sm',
      },
      'This link is valid for one hour.',
    ),
    createElement(
      EmailButton,
      {
        href: url,
      },
      'Confirm my address \u2192',
    ),
    createElement(EmailFallback, {
      url: url,
    }),
  )
}
export default VerifyEmail
