# @alfredmouelle/email-kit

Composable React Email primitives with a **swappable theme**. Build templates
once; restyle every email by passing a theme override — no template changes.

## Primitives

`EmailLayout` (card shell: header brand band, body, footer) · `EmailHeading`
(with optional kicker) · `EmailBodyText` (muted / sm) · `EmailButton`
(primary / destructive) · `EmailFallback` (copy-this-link block).

```tsx
import { EmailLayout, EmailHeading, EmailButton } from '@alfredmouelle/email-kit'

export function VerifyEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Confirm your email.">
      <EmailHeading kicker="Confirmation">Confirm your address.</EmailHeading>
      <EmailButton href={url}>Confirm →</EmailButton>
    </EmailLayout>
  )
}
```

## Swapping the theme (colors / brand / font)

The theme is a set of design tokens read from React context. Override any subset:

```tsx
import { createEmailTheme } from '@alfredmouelle/email-kit'

const theme = createEmailTheme({
  brand: { name: 'NEON', footer: 'NEON Inc.' },
  colors: { fgStrong: '#00ff88', pageBg: '#0a0a0a' },
})

// per email:
<EmailLayout preview="…" theme={theme}>…</EmailLayout>
```

Pass `year={...}` to `EmailLayout` to keep rendered output deterministic (tests,
snapshots). Otherwise it uses the current year.

## Local preview

```bash
pnpm --filter @alfredmouelle/email-kit email:dev   # react-email studio on :3001
```

Drop `*.tsx` files in `emails/` that default-export a preview component
(see `emails/verify-email.tsx`).
