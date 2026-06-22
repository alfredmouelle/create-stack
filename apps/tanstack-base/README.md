# tanstack-base

Reference TanStack Start app — fork it to start a new project. Comes wired with
the full personal foundation:

- **baseline** — `~/*` alias, typed `env.ts`, strict Biome, Tailwind v4 + shadcn
  (Geist, dark mode)
- **data** — Drizzle (Postgres) + drizzle-kit, faker seed harness
- **auth** — better-auth (email/password + verification, optional Google) + a full
  auth UI (sign-in/up, forgot/reset, verify) with `@tanstack/react-form`
- **email** — mailer (Resend) + email-kit templates (`email:dev` studio)
- **API** — tRPC (`useTRPC`) + TanStack React Query with SSR hydration
- **UI utilities** — theme toggle (light/dark/system), DataTable, DatePicker
- **deploy** — multi-stage `Dockerfile` (Nitro output) for a VPS

```bash
pnpm --filter @alfredmouelle/tanstack-base dev    # http://localhost:3000
```

Add more swappable tools with **add-capability**.

# Author

Alfred MOUELLE | FullStack Developer

[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/kali47_)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)
[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)
