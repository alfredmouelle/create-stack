import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  site: 'https://create-stack.alfredmouelle.com',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
