import { sentryVitePlugin } from '@sentry/vite-plugin'
import type { Plugin } from 'vite'

export function sentryPlugins(): Plugin[] {
  return [
    {
      name: 'create-stack-sentry-source-maps',
      apply: 'build',
      config() {
        return { build: { sourcemap: 'hidden' } }
      },
    },
    ...sentryVitePlugin({
      telemetry: false,
      ...(process.env.SENTRY_AUTH_TOKEN === undefined
        ? {}
        : { authToken: process.env.SENTRY_AUTH_TOKEN }),
      ...(process.env.SENTRY_ORG === undefined ? {} : { org: process.env.SENTRY_ORG }),
      ...(process.env.SENTRY_PROJECT === undefined ? {} : { project: process.env.SENTRY_PROJECT }),
      sourcemaps: { assets: ['./dist/**'], filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    }),
  ]
}
