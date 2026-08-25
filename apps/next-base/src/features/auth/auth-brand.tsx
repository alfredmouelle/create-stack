import { siteConfig } from '~/lib/site-config'

export function AuthBrand() {
  return (
    <section className="relative order-2 min-h-80 overflow-hidden bg-[#0e1a28] p-8 text-[#dce9f4] lg:order-1 lg:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border border-[#dce9f4]/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-12 bottom-12 size-24 rounded-full bg-[#66a2ff]/20 blur-2xl"
      />

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
          <p className="font-mono text-[#66a2ff] text-xs uppercase tracking-[0.16em]">
            A clear way in
          </p>
          <h1 className="mt-5 max-w-sm font-heading font-medium text-4xl tracking-[-0.04em] sm:text-5xl">
            Your work starts here.
          </h1>
          <p className="mt-5 max-w-sm text-[#dce9f4]/70 text-sm leading-6">
            {siteConfig.description}
          </p>
        </div>

        <div className="flex items-center gap-3 border-[#dce9f4]/15 border-t pt-4 font-mono text-[#dce9f4]/60 text-xs">
          <span className="size-2 rounded-full bg-[#66a2ff]" />
          <span>Account access</span>
        </div>
      </div>
    </section>
  )
}
