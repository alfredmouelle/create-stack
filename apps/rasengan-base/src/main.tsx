import type { ReactNode } from 'react'
import { ThemeProvider } from '~/components/theme-provider'
import { TRPCReactProvider } from '~/trpc/react'
import './styles.css'

type AppProps = {
  // biome-ignore lint/style/useNamingConvention: Rasengan supplies the Component property
  readonly Component: (props: { readonly children: ReactNode }) => ReactNode | Promise<ReactNode>
  readonly children?: ReactNode
}

export default function App({ Component, children }: AppProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <TRPCReactProvider>
        <Component>{children}</Component>
      </TRPCReactProvider>
    </ThemeProvider>
  )
}
