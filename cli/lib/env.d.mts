export function renderEnvironment(keys: readonly string[], requiredKeys?: readonly string[]): string
export function writeEnv(
  projectDir: string,
  keys: readonly string[],
  requiredKeys?: readonly string[],
  localValues?: Readonly<Record<string, string | undefined>>,
  testValues?: Readonly<Record<string, string>> | null,
): void
export function appendRawEnvLines(projectDir: string, lines: readonly string[]): void
export function appendEnv(
  projectDir: string,
  keys: readonly string[],
  requiredKeys?: readonly string[],
): void
