import { siteConfig } from '~/lib/site-config'

export function AuthBrand() {
  return (
    <section className="relative order-2 min-h-80 overflow-hidden bg-[#0b0d0c] p-8 text-[#f6f7f6] lg:order-1 lg:p-12">
      <div className="relative flex h-full flex-col justify-between gap-16">
        <div className="flex items-center gap-3">
          <img
            alt=""
            aria-hidden="true"
            className="size-10"
            height="40"
            src="/favicon.svg"
            width="40"
          />
          <span className="font-heading font-semibold tracking-tight">{siteConfig.name}</span>
        </div>

        <div className="max-w-md">
          <p className="font-mono text-[#3fb950] text-xs uppercase tracking-[0.16em]">
            A clear way in
          </p>
          <h1 className="mt-5 max-w-sm font-heading font-semibold font-stretch-88% text-4xl tracking-[-0.045em] sm:text-5xl">
            Your work starts here.
          </h1>
          <p className="mt-5 max-w-sm text-[#8a8f8b] text-sm leading-6">{siteConfig.description}</p>
        </div>

        <div className="flex items-center gap-3 border-[#2a302c] border-t pt-4 font-mono text-[#8a8f8b] text-xs">
          <span className="size-2 bg-[#3fb950]" />
          <span>Account access</span>
        </div>
      </div>
    </section>
  )
}
