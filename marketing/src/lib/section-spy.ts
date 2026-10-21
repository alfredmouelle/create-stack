const SIDEBAR_QUERY = '(min-width: 900px)'

export function trackSectionIndex(): void {
  const index = document.querySelector<HTMLElement>('.section-index')
  if (index) watchSectionIndex(index)
}

function watchSectionIndex(index: HTMLElement): void {
  const links = [...index.querySelectorAll<HTMLAnchorElement>('[data-spy-target]')]
  const sections = links.flatMap((link) => {
    const section = document.getElementById(link.dataset.spyTarget ?? '')
    return section ? [{ link, section }] : []
  })
  const sidebar = window.matchMedia(SIDEBAR_QUERY)
  let frame = 0
  let active: HTMLAnchorElement | undefined

  function revealInIndex(link: HTMLAnchorElement) {
    const bounds = index.getBoundingClientRect()
    const target = link.getBoundingClientRect()
    if (index.scrollWidth > index.clientWidth) {
      index.scrollLeft += target.left - bounds.left - (bounds.width - target.width) / 2
    }
    if (index.scrollHeight > index.clientHeight) {
      index.scrollTop += target.top - bounds.top - (bounds.height - target.height) / 2
    }
  }

  function update() {
    frame = 0
    const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0
    const stickyBar = sidebar.matches ? header : index.getBoundingClientRect().bottom
    const threshold = Math.max(header, stickyBar) + window.innerHeight * 0.25
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    const current = atBottom
      ? sections.at(-1)
      : (sections.findLast(({ section }) => section.getBoundingClientRect().top <= threshold) ??
        sections[0])
    if (!current || current.link === active) return
    active?.removeAttribute('aria-current')
    current.link.setAttribute('aria-current', 'true')
    active = current.link
    revealInIndex(current.link)
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(update)
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  update()
}
