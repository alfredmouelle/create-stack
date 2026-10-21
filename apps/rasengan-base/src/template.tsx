import type { ReactNode } from 'react'
import { siteConfig } from '~/lib/site-config'

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var m=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&m));}catch(e){}})();`

type TemplateProps = {
  // biome-ignore lint/style/useNamingConvention: Rasengan supplies the Head property
  readonly Head: (props: { readonly children: ReactNode }) => ReactNode
  // biome-ignore lint/style/useNamingConvention: Rasengan supplies the Body property
  readonly Body: (props: { readonly children: ReactNode }) => ReactNode
  // biome-ignore lint/style/useNamingConvention: Rasengan supplies the Script property
  readonly Script: (props: { readonly children?: ReactNode }) => ReactNode
}

export default function Template({ Head, Body, Script }: TemplateProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        <meta charSet="UTF-8" />
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        <meta content={siteConfig.description} name="description" />
        <title>{siteConfig.name}</title>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/manifest.json" rel="manifest" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: apply the saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </Head>
      <Body>
        <Script />
      </Body>
    </html>
  )
}
