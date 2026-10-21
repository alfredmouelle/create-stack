import {
  type Auth,
  CAPABILITY_CATALOG,
  type Database,
  DEFAULT_IMPORT_ALIAS,
  FORMATTERS,
  type Formatter,
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  type Framework,
  isValidImportAlias,
  LINTERS,
  type Linter,
  type Mailer,
  MONOREPO_ORCHESTRATORS,
  PACKAGE_MANAGERS,
  QUALITY_TOOL_LABELS,
  RECOMMENDED_FRAMEWORK,
  type StackAxis,
} from '@alfredmouelle/stack-config'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { IMPLEMENTER_GUIDE_URL, PLANNED_FRAMEWORKS } from '../data/frameworks'
import { captureCommandCopied, captureShareLinkCopied } from '../lib/analytics'
import {
  type BuildState,
  type BuildStateResult,
  CAPABILITY_LABELS,
  creationPlanLines,
  defaultBuildState,
  MONOREPO_LABELS,
  type ParsedBuildState,
  parseBuildState,
  resolveBuildState,
  serializeBuildState,
} from '../lib/build-config'

type CopyState = 'idle' | 'copied' | 'error'

type UpdateState = (patch: Partial<BuildState>) => void

type ChoiceOption<Value extends string | boolean> = {
  value: Value
  label: string
}

const COPY_FAILURE = 'Copy unavailable. Select the command, then press Ctrl+C or Cmd+C.'

const databaseOptions: readonly ChoiceOption<Database>[] = [
  { value: 'drizzle', label: 'Drizzle' },
  { value: 'prisma', label: 'Prisma' },
  { value: 'convex', label: 'Convex' },
  { value: 'none', label: 'none' },
]

const authOptions: readonly ChoiceOption<Auth>[] = [
  { value: 'better-auth', label: 'Better Auth' },
  { value: 'clerk', label: 'Clerk' },
  { value: 'none', label: 'none' },
]

const mailerOptions: readonly ChoiceOption<Mailer>[] = [
  { value: 'resend', label: 'Resend' },
  { value: 'brevo', label: 'Brevo' },
  { value: 'ses', label: 'Amazon SES' },
  { value: 'none', label: 'none' },
]

const trpcOptions: readonly ChoiceOption<boolean>[] = [
  { value: true, label: 'tRPC' },
  { value: false, label: 'No tRPC' },
]

const formatterOptions: readonly ChoiceOption<Formatter>[] = FORMATTERS.map((value) => ({
  value,
  label: QUALITY_TOOL_LABELS[value],
}))

const linterOptions: readonly ChoiceOption<Linter>[] = LINTERS.map((value) => ({
  value,
  label: QUALITY_TOOL_LABELS[value],
}))

const frameworkOptions: readonly ChoiceOption<Framework>[] = FRAMEWORKS.map((value) => ({
  value,
  label: FRAMEWORK_SUPPORT[value].label,
}))

function isRecommended(framework: Framework, axis: StackAxis, value: string | boolean): boolean {
  if (axis === 'framework') return value === RECOMMENDED_FRAMEWORK
  const recommendations: Readonly<Record<string, unknown>> =
    FRAMEWORK_SUPPORT[framework].recommendations
  const recommended = recommendations[axis]
  return Array.isArray(recommended) ? recommended.includes(value) : recommended === value
}

function reasonFor(result: BuildStateResult, axis: StackAxis) {
  return result.reasons.find((reason) => reason.axis === axis)
}

function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const [kept, setKept] = useState<ReactNode>(open ? children : null)
  if (open && kept !== children) setKept(children)

  return (
    <div className="reveal" data-open={open} inert={!open}>
      <div className="reveal-inner">{open ? children : kept}</div>
    </div>
  )
}

function Axis({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <fieldset aria-labelledby={`${id}-label`} className="axis">
      <div className="axis-label">
        <span id={`${id}-label`}>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="axis-body">{children}</div>
    </fieldset>
  )
}

function ChoiceChips<Value extends string | boolean>({
  axis,
  options,
  result,
  selectedValue,
  supportedValues,
  onChange,
}: {
  axis: StackAxis
  options: readonly ChoiceOption<Value>[]
  result: BuildStateResult
  selectedValue: Value
  supportedValues?: readonly Value[]
  onChange: (value: Value) => void
}) {
  const framework = result.configuration.framework
  const conflicted = result.conflicts.some((conflict) => conflict.axes.includes(axis))
  const reason = reasonFor(result, axis)

  return (
    <>
      <div className="chips">
        {options.map((option) => {
          const unsupported =
            supportedValues !== undefined && !supportedValues.includes(option.value)
          const selected = selectedValue === option.value
          const state = unsupported
            ? 'unsupported'
            : selected && conflicted
              ? 'conflict'
              : selected
                ? 'selected'
                : 'idle'
          return (
            <label className="chip" data-state={state} key={String(option.value)}>
              <input
                checked={selected}
                className="chip-input"
                disabled={unsupported}
                name={axis}
                onChange={() => onChange(option.value)}
                type="radio"
                value={String(option.value)}
              />
              {option.label}
              {isRecommended(framework, axis, option.value) ? (
                <span className="chip-mark">recommended</span>
              ) : null}
            </label>
          )
        })}
      </div>
      <Reveal open={conflicted}>
        {result.conflicts
          .filter((conflict) => conflict.axes.includes(axis))
          .map((conflict) => (
            <p className="chip-reason is-conflict" key={conflict.message}>
              {conflict.message}
            </p>
          ))}
      </Reveal>
      <Reveal open={!conflicted && reason !== undefined}>
        {reason ? (
          <p className="chip-reason" data-reason-kind={reason.kind}>
            ↳ {reason.message}
          </p>
        ) : null}
      </Reveal>
    </>
  )
}

function UnofferedChip({ label }: { label: string }) {
  return (
    <span aria-disabled="true" className="chip" data-state="unsupported">
      {label}
    </span>
  )
}

function CapabilityRow({
  capability,
  state,
  updateState,
}: {
  capability: (typeof CAPABILITY_CATALOG)[number]
  state: BuildState
  updateState: UpdateState
}) {
  const provider = state.capabilities[capability.name]
  const selected = provider !== undefined

  const labelId = `capability-${capability.name}-label`

  function toggle(option: string) {
    const capabilities = { ...state.capabilities }
    if (provider === option) delete capabilities[capability.name]
    else capabilities[capability.name] = option
    updateState({ capabilities })
  }

  return (
    <div className="capability" data-selected={selected}>
      <span className="capability-label" id={labelId}>
        {CAPABILITY_LABELS[capability.name]}
      </span>
      <fieldset aria-labelledby={labelId} className="chips is-small">
        {capability.providers.map((option) => (
          <button
            aria-pressed={provider === option}
            className="chip is-small is-toggle"
            data-state={provider === option ? 'selected' : 'idle'}
            key={option}
            onClick={() => toggle(option)}
            type="button"
          >
            {option}
          </button>
        ))}
        {capability.providers.length === 1 ? (
          <span className="chip-note">single provider</span>
        ) : null}
      </fieldset>
    </div>
  )
}

function BuildRecovery({ route, onRestore }: { route: ParsedBuildState; onRestore: () => void }) {
  if (route.kind === 'current') return null

  return (
    <main className="shell recovery" data-state={route.kind} role="alert">
      <p className="t-label">Configuration link</p>
      <h1 className="t-h1">
        {route.kind === 'unsupported'
          ? 'That build link uses an older schema.'
          : 'This build link could not be read.'}
      </h1>
      <p className="t-lead">
        {route.kind === 'unsupported'
          ? `Version ${route.version} is not understood by this builder. Start from the current recommended stack.`
          : `${route.message}. Start from the current recommended stack to continue.`}
      </p>
      <button className="button is-primary" onClick={onRestore} type="button">
        Use the current recommended stack
      </button>
    </main>
  )
}

function StackChoices({
  state,
  result,
  updateState,
}: {
  state: BuildState
  result: BuildStateResult
  updateState: UpdateState
}) {
  const { supports } = FRAMEWORK_SUPPORT[result.configuration.framework]
  const aliasValue = state.alias ?? DEFAULT_IMPORT_ALIAS
  const aliasIsValid = isValidImportAlias(aliasValue)

  return (
    <div className="build-form">
      <div className="axis">
        <div className="axis-label">
          <label htmlFor="project-name">Project name</label>
          <small>directory and package name</small>
        </div>
        <div className="axis-body">
          <input
            aria-invalid={!state.projectName.trim()}
            className="field"
            id="project-name"
            onChange={(event) => updateState({ projectName: event.currentTarget.value })}
            placeholder="my-app"
            spellCheck="false"
            value={state.projectName}
          />
          <Reveal open={!state.projectName.trim()}>
            <p className="chip-reason is-conflict" role="alert">
              Enter a project name to generate a command.
            </p>
          </Reveal>
        </div>
      </div>

      <Axis id="framework" label="Framework">
        <ChoiceChips
          axis="framework"
          onChange={(framework) => updateState({ framework })}
          options={frameworkOptions}
          result={result}
          selectedValue={state.framework ?? result.configuration.framework}
        />
        <div className="chips">
          {PLANNED_FRAMEWORKS.slice(0, 1).map((framework) => (
            <UnofferedChip key={framework.id} label={`${framework.label} · planned`} />
          ))}
        </div>
        <p className="chip-reason">
          Planned frameworks are listed, not selectable.{' '}
          <a href={IMPLEMENTER_GUIDE_URL} rel="noreferrer" target="_blank">
            Own one →
          </a>
        </p>
      </Axis>

      <Axis id="database" label="Database">
        <ChoiceChips
          axis="database"
          onChange={(database) => updateState({ database })}
          options={databaseOptions}
          result={result}
          selectedValue={state.database ?? result.configuration.database}
          supportedValues={supports.database}
        />
      </Axis>

      <Axis id="auth" label="Authentication">
        <ChoiceChips
          axis="auth"
          onChange={(auth) => updateState({ auth })}
          options={authOptions}
          result={result}
          selectedValue={state.auth ?? result.configuration.auth}
          supportedValues={supports.auth}
        />
      </Axis>

      <Axis id="trpc" label="API">
        <ChoiceChips
          axis="trpc"
          onChange={(trpc) => updateState({ trpc })}
          options={trpcOptions}
          result={result}
          selectedValue={state.trpc ?? result.configuration.trpc}
          supportedValues={supports.trpc}
        />
      </Axis>

      <Axis id="mailer" label="Mailer">
        <ChoiceChips
          axis="mailer"
          onChange={(mailer) => updateState({ mailer })}
          options={mailerOptions}
          result={result}
          selectedValue={state.mailer ?? result.configuration.mailer}
          supportedValues={supports.mailer}
        />
      </Axis>

      <Axis id="formatter" label="Formatter">
        <ChoiceChips
          axis="formatter"
          onChange={(formatter) => updateState({ formatter })}
          options={formatterOptions}
          result={result}
          selectedValue={state.formatter ?? result.configuration.formatter}
          supportedValues={supports.formatter}
        />
        <div className="chips">
          <UnofferedChip label="oxfmt" />
        </div>
        <p className="chip-reason">
          oxfmt and no formatter are not offered: every project ships a strict formatter.
        </p>
      </Axis>

      <Axis id="linter" label="Linter">
        <ChoiceChips
          axis="linter"
          onChange={(linter) => updateState({ linter })}
          options={linterOptions}
          result={result}
          selectedValue={state.linter ?? result.configuration.linter}
          supportedValues={supports.linter}
        />
        <div className="chips">
          <UnofferedChip label="ESLint" />
        </div>
        <p className="chip-reason">ESLint waits for typescript-eslint support of TypeScript 7.</p>
      </Axis>

      <Axis hint="add more later with create-stack add" id="capabilities" label="Capabilities">
        {CAPABILITY_CATALOG.map((capability) => (
          <CapabilityRow
            capability={capability}
            key={capability.name}
            state={state}
            updateState={updateState}
          />
        ))}
      </Axis>

      <div className="axis">
        <div className="axis-label">
          <label htmlFor="import-alias">Import alias</label>
          <small>rewrites &lt;alias&gt;/* to src/*</small>
        </div>
        <div className="axis-body">
          <input
            aria-invalid={!aliasIsValid}
            className="field"
            id="import-alias"
            onChange={(event) => updateState({ alias: event.currentTarget.value })}
            placeholder={DEFAULT_IMPORT_ALIAS}
            spellCheck="false"
            value={aliasValue}
          />
          <Reveal open={!aliasIsValid}>
            <p className="chip-reason is-conflict" role="alert">
              Use an optional @, ~ or # followed by letters, digits, _ or -.
            </p>
          </Reveal>
        </div>
      </div>

      <Axis id="monorepo" label="Monorepo">
        <div className="chips">
          {[
            { value: undefined, label: 'none' },
            ...MONOREPO_ORCHESTRATORS.map((value) => ({ value, label: MONOREPO_LABELS[value] })),
          ].map((monorepo) => (
            <label
              className="chip"
              data-state={state.monorepo === monorepo.value ? 'selected' : 'idle'}
              key={monorepo.label}
            >
              <input
                checked={state.monorepo === monorepo.value}
                className="chip-input"
                name="monorepo"
                onChange={() => updateState({ monorepo: monorepo.value })}
                type="radio"
              />
              {monorepo.label}
            </label>
          ))}
        </div>
        <Reveal open={state.monorepo !== undefined}>
          <p className="chip-reason">↳ app in apps/web</p>
        </Reveal>
      </Axis>

      <Axis id="package-manager" label="Package manager">
        <div className="chips">
          {PACKAGE_MANAGERS.map((packageManager) => (
            <label
              className="chip"
              data-state={state.packageManager === packageManager ? 'selected' : 'idle'}
              key={packageManager}
            >
              <input
                checked={state.packageManager === packageManager}
                className="chip-input"
                name="package-manager"
                onChange={() => updateState({ packageManager })}
                type="radio"
              />
              {packageManager}
            </label>
          ))}
        </div>
      </Axis>
    </div>
  )
}

function CommandPanel({
  state,
  result,
  copyState,
  shareState,
  commandRef,
  copyCommand,
  copyShareLink,
}: {
  state: BuildState
  result: BuildStateResult
  copyState: CopyState
  shareState: CopyState
  commandRef: React.RefObject<HTMLElement | null>
  copyCommand: () => void
  copyShareLink: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasConflicts = result.conflicts.length > 0
  const command = result.command ?? 'Resolve the highlighted choices to get a command.'
  const shareUrl = `create-stack.alfredmouelle.com/build${serializeBuildState(state)}`

  return (
    <aside aria-label="Generated command and creation plan" className="panel" data-open={isOpen}>
      <div className="panel-summary">
        <span className="panel-count" data-state={hasConflicts ? 'conflict' : 'clear'}>
          {conflictSummary(result.conflicts.length)}
        </span>
        <button
          aria-expanded={isOpen}
          className="panel-toggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? 'Hide plan ▾' : 'Show plan ▴'}
        </button>
      </div>
      <div className="panel-head">
        <span className="t-label">Command</span>
        <span className="t-label">{state.packageManager}</span>
      </div>
      <div className="cmd is-block" data-state={result.command ? 'ready' : 'blocked'}>
        <div className="cmd-line">
          <span aria-hidden="true" className="cmd-prompt">
            $
          </span>
          <code className="cmd-code is-wrapping" id="generated-command" ref={commandRef}>
            {command.split(' ').map((token, index) => [
              index ? ' ' : '',
              <span className="cmd-token" key={`${index}-${token}`}>
                {token}
              </span>,
            ])}
          </code>
          <button
            className="copy-button"
            data-state={copyState}
            disabled={!result.command}
            onClick={copyCommand}
            type="button"
          >
            {copyState === 'copied' ? 'Copied ✓' : 'Copy command'}
          </button>
        </div>
      </div>
      <p className="panel-status" data-state={copyState} role="status">
        {commandStatus(copyState, result.command !== null)}
      </p>
      <div className="panel-details">
        <div className="share">
          <span className="share-url">{shareUrl}</span>
          <button className="copy-button" onClick={copyShareLink} type="button">
            {shareState === 'copied' ? 'Link copied ✓' : 'Copy share link'}
          </button>
        </div>
        <p className="panel-status" data-state={shareState} role="status">
          {SHARE_STATUS[shareState]}
        </p>
        <Reveal open={hasConflicts}>
          <section aria-labelledby="conflicts-heading" className="conflicts" role="alert">
            <h2 id="conflicts-heading">These choices cannot ship together.</h2>
            <ul>
              {result.conflicts.map((conflict) => (
                <li key={conflict.message}>■ {conflict.message}</li>
              ))}
            </ul>
          </section>
        </Reveal>
        <span className="t-label">Creation plan</span>
        <div className="terminal">
          <div className="terminal-body is-compact">
            <span className="terminal-line is-heading">
              <span aria-hidden="true" className="terminal-prefix">
                ◇{'  '}
              </span>
              Creation plan
            </span>
            <Reveal open={hasConflicts}>
              <span className="terminal-line is-conflict">
                <span aria-hidden="true" className="terminal-prefix">
                  │{'  '}
                </span>
                Not resolved: the CLI stops here and writes no file.
              </span>
            </Reveal>
            <Reveal open={!hasConflicts}>
              {creationPlanLines(state, result).map((line) => (
                <span className="terminal-line is-output" key={line}>
                  <span aria-hidden="true" className="terminal-prefix">
                    │{'  '}
                  </span>
                  {line}
                </span>
              ))}
            </Reveal>
          </div>
        </div>
      </div>
    </aside>
  )
}

function commandStatus(copyState: CopyState, hasCommand: boolean) {
  if (copyState === 'copied') return 'Command copied to your clipboard.'
  if (copyState === 'error') return COPY_FAILURE
  return hasCommand
    ? 'Run it from the directory where you want the project.'
    : 'Command generation is paused until the choices are resolved.'
}

const SHARE_STATUS = {
  idle: 'The link updates as you make a choice.',
  copied: 'Anyone with this link can restore this configuration.',
  error: COPY_FAILURE,
} as const satisfies Record<CopyState, string>

function conflictSummary(count: number) {
  if (count === 0) return '✓ no conflicts'
  return `■ ${count} ${count === 1 ? 'conflict' : 'conflicts'}`
}

function persist(next: BuildState) {
  window.history.replaceState(null, '', `${window.location.pathname}${serializeBuildState(next)}`)
}

export default function BuildConfigurator() {
  const [state, setState] = useState<BuildState>(() => defaultBuildState())
  const [route, setRoute] = useState<ParsedBuildState>(() => ({
    kind: 'current',
    state: defaultBuildState(),
  }))
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [shareState, setShareState] = useState<CopyState>('idle')
  const commandRef = useRef<HTMLElement>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    function readUrl() {
      const parsed = parseBuildState(window.location.search)
      setRoute(parsed)
      if (parsed.kind !== 'current') return
      stateRef.current = parsed.state
      setState(parsed.state)
      if (window.location.search !== serializeBuildState(parsed.state)) persist(parsed.state)
    }

    readUrl()
    window.addEventListener('popstate', readUrl)
    return () => window.removeEventListener('popstate', readUrl)
  }, [])

  const result = useMemo(() => resolveBuildState(state), [state])

  function replaceState(next: BuildState) {
    stateRef.current = next
    setState(next)
    setRoute({ kind: 'current', state: next })
    persist(next)
    setCopyState('idle')
    setShareState('idle')
  }

  function updateState(patch: Partial<BuildState>) {
    replaceState({ ...stateRef.current, ...patch })
  }

  async function copyCommand() {
    if (!result.command) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(result.command)
      setCopyState('copied')
      captureCommandCopied({
        configuration: result.configuration,
        packageManager: state.packageManager,
        source: 'wizard',
        state,
      })
    } catch {
      setCopyState('error')
      const command = commandRef.current
      if (command) window.getSelection()?.selectAllChildren(command)
    }
  }

  async function copyShareLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(window.location.href)
      setShareState('copied')
      captureShareLinkCopied()
    } catch {
      setShareState('error')
    }
  }

  if (route.kind !== 'current') {
    return <BuildRecovery onRestore={() => replaceState(defaultBuildState())} route={route} />
  }

  return (
    <main className="shell build">
      <div className="build-head">
        <div className="stack is-tight">
          <p className="t-label">Stack builder</p>
          <h1 className="t-h1">Build your stack</h1>
        </div>
        <button
          className="button is-quiet"
          onClick={() => replaceState(defaultBuildState())}
          type="button"
        >
          Reset to recommended
        </button>
      </div>
      <div className="build-layout">
        <StackChoices result={result} state={state} updateState={updateState} />
        <CommandPanel
          commandRef={commandRef}
          copyCommand={copyCommand}
          copyShareLink={copyShareLink}
          copyState={copyState}
          result={result}
          shareState={shareState}
          state={state}
        />
      </div>
    </main>
  )
}
