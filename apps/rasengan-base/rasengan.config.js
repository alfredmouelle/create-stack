import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'rasengan'
import { rasengan } from 'rasengan/plugin'

const port = Number(process.env.PORT ?? 3000)

export default defineConfig({
  runtime: 'node',
  ssr: true,
  prerender: false,
  server: { development: { port, open: false } },
  vite: {
    plugins: [
      ...tailwindcss(),
      rasengan(),
      {
        name: 'create-stack-config',
        config() {
          return {
            environments: {
              ssr: { build: { rolldownOptions: { input: { environment: './src/env.ts' } } } },
            },
            resolve: { tsconfigPaths: true },
            server: { port, strictPort: true, ws: { port: port + 2 } },
          }
        },
      },
    ],
  },
})
