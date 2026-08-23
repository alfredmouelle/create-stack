import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import { PUBLIC_SITE_ORIGIN } from './src/lib/site-metadata'

export default defineConfig({
  output: 'static',
  site: PUBLIC_SITE_ORIGIN,
  integrations: [react()],
})
