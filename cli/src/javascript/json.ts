import { readFileSync, writeFileSync } from 'node:fs'

export type JsonObject = Record<string, unknown>

export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function readJsonObject(path: string): JsonObject {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isJsonObject(value)) throw new Error(`Expected a JSON object in ${path}`)
  return value
}

export const writeJsonObject = (path: string, value: JsonObject): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
