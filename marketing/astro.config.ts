import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { PUBLIC_SITE_ORIGIN } from './src/lib/site-metadata'

export default defineConfig({
  output: 'static',
  site: PUBLIC_SITE_ORIGIN,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
