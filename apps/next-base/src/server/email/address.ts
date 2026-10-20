import type { MailAddress, MailRecipient } from './port'

const ADDRESS_RE = /^\s*(.*?)\s*<([^>]+)>\s*$/u

export function normalizeAddress(input: MailRecipient): MailAddress {
  if (typeof input !== 'string') return input
  const match = input.match(ADDRESS_RE)
  if (match?.[2] !== undefined)
    return { name: match[1] === '' ? undefined : match[1], email: match[2].trim() }
  return { email: input.trim() }
}

export function normalizeRecipients(
  input: MailRecipient | readonly MailRecipient[],
): MailAddress[] {
  return (typeof input === 'string' || 'email' in input ? [input] : input).map((recipient) =>
    normalizeAddress(recipient),
  )
}

export function formatAddress(address: MailAddress): string {
  return address.name !== undefined && address.name !== ''
    ? `${address.name} <${address.email}>`
    : address.email
}
