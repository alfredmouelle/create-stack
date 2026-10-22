export function captureServerError(error: unknown): void {
  console.error('Request failed', error)
}
