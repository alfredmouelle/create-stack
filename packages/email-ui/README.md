# @alfredmouelle/email-ui

Composable React Email primitives with theme tokens. Build a template once and
change its brand or colors through a theme override.

## Primitives

`EmailLayout` (card shell: header brand band, body, footer) · `EmailHeading`
(with optional kicker) · `EmailBodyText` (muted / sm) · `EmailButton`
(primary / destructive) · `EmailFallback` (copy-this-link block).

```tsx
import { EmailLayout, EmailHeading, EmailButton } from '@alfredmouelle/email-ui'

export function VerifyEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Confirm your email.">
      <EmailHeading kicker="Confirmation">Confirm your address.</EmailHeading>
      <EmailButton href={url}>Confirm email</EmailButton>
    </EmailLayout>
  )
}
```

## Swapping the theme (colors / brand / font)

The theme is a set of design tokens read from React context. Override any subset:

```tsx
import { createEmailTheme } from '@alfredmouelle/email-ui'

const theme = createEmailTheme({
  brand: { name: 'NEON', footer: 'NEON Inc.' },
  colors: { fgStrong: '#00ff88', pageBg: '#0a0a0a' },
})

// per email:
<EmailLayout preview="…" theme={theme}>…</EmailLayout>
```

Pass `year={...}` to `EmailLayout` when tests or snapshots need deterministic
output. Without it, the component uses the current year.

## Local preview

```bash
pnpm --filter @alfredmouelle/email-ui email:dev   # react-email studio on :3001
```

Add `*.tsx` files to `emails/` and default-export a preview component. See
`emails/verify-email.tsx` for an example.
