import type { MailAddress, MailRecipient } from './port'

const ADDRESS_RE = /^\s*(.*?)\s*<([^>]+)>\s*$/

/** Coerce recipient to {@link MailAddress}. */
export function normalizeAddress(input: MailRecipient): MailAddress {
  if (typeof input !== 'string') return input
  const match = input.match(ADDRESS_RE)
  if (match?.[2]) return { name: match[1] || undefined, email: match[2].trim() }
  return { email: input.trim() }
}

/** Coerce recipient(s) to normalized array. */
export function normalizeRecipients(input: MailRecipient | MailRecipient[]): MailAddress[] {
  return (Array.isArray(input) ? input : [input]).map(normalizeAddress)
}

/** Render address to RFC string (`Name <email>`). */
export function formatAddress(address: MailAddress): string {
  return address.name ? `${address.name} <${address.email}>` : address.email
}
