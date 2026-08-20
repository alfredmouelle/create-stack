import type { MailAddress, MailRecipient } from './port.js'

const ADDRESS_RE = /^\s*(.*?)\s*<([^>]+)>\s*$/

export function normalizeAddress(input: MailRecipient): MailAddress {
  if (typeof input !== 'string') return input
  const match = input.match(ADDRESS_RE)
  if (match?.[2]) return { name: match[1] || undefined, email: match[2].trim() }
  return { email: input.trim() }
}

export function normalizeRecipients(input: MailRecipient | MailRecipient[]): MailAddress[] {
  return (Array.isArray(input) ? input : [input]).map(normalizeAddress)
}

export function formatAddress(address: MailAddress): string {
  return address.name ? `${address.name} <${address.email}>` : address.email
}
