# next-base

Reference Next.js (App Router) app: fork it to start a new project. Comes wired
with the full personal foundation:

- **baseline**: `~/*` alias, typed `env.ts`, strict Biome, Tailwind v4 + shadcn
  (Geist, dark mode)
- **data**: Drizzle (Postgres) + drizzle-kit, faker seed harness
- **auth**: better-auth (email/password + verification, optional Google) + a full
  auth UI (sign-in/up, forgot/reset, verify) with shadcn `Form` (react-hook-form +
  valibot)
- **email**: mailer (Resend) + email-kit templates (`email:dev` studio)
- **API**: tRPC with the `api.x.useQuery` hooks + RSC hydration
- **UI utilities**: theme toggle (light/dark/system), DataTable, DatePicker
- **deploy**: multi-stage `Dockerfile` (standalone output) for a VPS

```bash
pnpm --filter @alfredmouelle/next-base dev    # http://localhost:3000
```

Add more swappable tools with **add-capability**.

## Coming from ESLint + Prettier?

This stack uses [Biome](https://biomejs.dev) instead. One tool, no config
juggling, near-instant. The mental map:

| You knew                           | Here                               |
| ---------------------------------- | ---------------------------------- |
| `eslint . && prettier --check .`   | `pnpm check`                       |
| `eslint --fix && prettier --write` | `pnpm check:write`                 |
| `.eslintrc` + `.prettierrc`        | a single `biome.jsonc`             |
| `// eslint-disable-next-line foo`  | `// biome-ignore lint/foo: reason` |

Format-on-save (VS Code + Zed) and the pre-commit hook are already wired.
Prefer ESLint? Nothing stops you from swapping it in, but the whole base is
tuned for Biome.

# Author

Alfred MOUELLE | FullStack Developer

[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/kali47_)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)
[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)
