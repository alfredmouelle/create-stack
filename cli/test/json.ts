import { readFileSync } from 'node:fs'

type JsonObject = Record<string, unknown>

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function readJson(path: string): JsonObject {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isJsonObject(value)) throw new Error(`Expected a JSON object in ${path}`)
  return value
}

export function readField(path: string, field: string): JsonObject {
  const value = readJson(path)[field]
  return isJsonObject(value) ? value : {}
}
