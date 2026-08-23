import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type BuildState,
  type BuildStateResult,
  CAPABILITY_CATALOG,
  defaultBuildState,
  MONOREPOS,
  PACKAGE_MANAGERS,
  type ParsedBuildState,
  parseBuildState,
  resolveBuildState,
  serializeBuildState,
} from '../lib/build-config'

type ChoiceOption = {
  value: string | boolean
  label: string
  hint?: string
}

type UpdateState = (patch: Partial<BuildState>) => void

interface ChoiceGroupProps {
  id: string
  label: string
  options: readonly ChoiceOption[]
  reason?: string
  reasonKind?: string
  selectedValue: string | boolean
  onChange: (value: string | boolean) => void
}

function ChoiceGroup({
  id,
  label,
  options,
  reason,
  reasonKind,
  selectedValue,
  onChange,
}: ChoiceGroupProps) {
  return (
    <fieldset className="build-choice-group">
      <legend>{label}</legend>
      <div className="build-choice-options">
        {options.map((option) => (
          <label className="build-choice" key={String(option.value)}>
            <input
              checked={selectedValue === option.value}
              name={id}
              onChange={() => onChange(option.value)}
              type="radio"
              value={String(option.value)}
            />
            <span className="build-choice-copy">
              <strong>{option.label}</strong>
              {option.hint ? <small>{option.hint}</small> : null}
            </span>
          </label>
        ))}
      </div>
      {reason ? (
        <p className="build-reason" data-reason-kind={reasonKind}>
          <span aria-hidden="true">↳</span> {reason}
        </p>
      ) : null}
    </fieldset>
  )
}

const frameworkOptions: readonly ChoiceOption[] = [
  { value: 'tanstack', label: 'TanStack Start', hint: 'recommended' },
  { value: 'next', label: 'Next.js', hint: 'App Router' },
]

const databaseOptions: readonly ChoiceOption[] = [
  { value: 'drizzle', label: 'Drizzle', hint: 'Postgres ORM' },
  { value: 'prisma', label: 'Prisma', hint: 'Postgres ORM' },
  { value: 'convex', label: 'Convex', hint: 'realtime database' },
  { value: 'none', label: 'None', hint: 'no database' },
]

const authOptions: readonly ChoiceOption[] = [
  { value: 'better-auth', label: 'Better Auth', hint: 'email + password' },
  { value: 'clerk', label: 'Clerk', hint: 'hosted authentication' },
  { value: 'none', label: 'None', hint: 'no authentication' },
]

const mailerOptions: readonly ChoiceOption[] = [
  { value: 'resend', label: 'Resend' },
  { value: 'brevo', label: 'Brevo' },
  { value: 'ses', label: 'Amazon SES' },
  { value: 'none', label: 'None', hint: 'no transactional mail' },
]

const trpcOptions: readonly ChoiceOption[] = [
  { value: true, label: 'Include tRPC' },
  { value: false, label: 'No tRPC' },
]

function reasonFor(result: BuildStateResult, axis: string) {
  const reason = result.reasons.find((candidate) => candidate.axis === axis)
  if (!reason) return undefined
  if (reason.kind === 'dependency') return `Added by dependency completion: ${reason.message}`
  if (reason.kind === 'recommended') return `Recommended: ${reason.message}`
  if (reason.kind === 'minimal') return `Minimal project: ${reason.message}`
  return reason.message
}

function reasonKindFor(result: BuildStateResult, axis: string) {
  return result.reasons.find((reason) => reason.axis === axis)?.kind
}

function copyFailureMessage() {
  return 'Copy unavailable. Select the command, then press Ctrl+C or Cmd+C.'
}

function BuildRecovery({ route, onRestore }: { route: ParsedBuildState; onRestore: UpdateState }) {
  if (route.kind === 'unsupported') {
    return (
      <section className="build-recovery page-shell" data-state="unsupported" role="alert">
        <p className="section-kicker">Configuration link</p>
        <h1>That build link uses an older schema.</h1>
        <p>
          Version {route.version} is not understood by this configurator. Your choices were left
          untouched; start from the current recommended stack when you are ready.
        </p>
        <button className="build-primary-button" onClick={() => onRestore({})} type="button">
          Use the current recommended stack
        </button>
      </section>
    )
  }

  if (route.kind === 'invalid') {
    return (
      <section className="build-recovery page-shell" data-state="invalid" role="alert">
        <p className="section-kicker">Configuration link</p>
        <h1>This build link could not be read.</h1>
        <p>{route.message}. Start from the current recommended stack to continue.</p>
        <button className="build-primary-button" onClick={() => onRestore({})} type="button">
          Use the current recommended stack
        </button>
      </section>
    )
  }

  return null
}

function ProjectPanel({ state, updateState }: { state: BuildState; updateState: UpdateState }) {
  return (
    <section aria-labelledby="project-heading" className="build-panel build-project-panel">
      <div className="build-panel-heading">
        <div>
          <p className="build-panel-index">01 / project</p>
          <h2 id="project-heading">Name the project</h2>
        </div>
        <span className="build-panel-note">required</span>
      </div>
      <label className="build-text-field" htmlFor="project-name">
        <span>Project name</span>
        <input
          id="project-name"
          onChange={(event) => updateState({ projectName: event.currentTarget.value })}
          placeholder="my-app"
          spellCheck="false"
          value={state.projectName}
        />
      </label>
      {!state.projectName.trim() ? (
        <p className="build-field-error" role="alert">
          Enter a project name to generate a command.
        </p>
      ) : null}
    </section>
  )
}

function StackPanel({
  state,
  result,
  updateState,
}: {
  state: BuildState
  result: BuildStateResult
  updateState: UpdateState
}) {
  return (
    <section aria-labelledby="stack-heading" className="build-panel">
      <div className="build-panel-heading">
        <div>
          <p className="build-panel-index">02 / main axes</p>
          <h2 id="stack-heading">Shape the stack</h2>
        </div>
        <span className="build-panel-note">recommendations on</span>
      </div>
      <div className="build-choice-grid">
        <ChoiceGroup
          id="framework"
          label="Framework"
          onChange={(value) => updateState({ framework: value as BuildState['framework'] })}
          options={frameworkOptions}
          reason={reasonFor(result, 'framework')}
          reasonKind={reasonKindFor(result, 'framework')}
          selectedValue={state.framework ?? result.configuration.framework}
        />
        <ChoiceGroup
          id="database"
          label="Database"
          onChange={(value) => updateState({ database: value as BuildState['database'] })}
          options={databaseOptions}
          reason={reasonFor(result, 'database')}
          reasonKind={reasonKindFor(result, 'database')}
          selectedValue={state.database ?? result.configuration.database}
        />
        <ChoiceGroup
          id="auth"
          label="Authentication"
          onChange={(value) => updateState({ auth: value as BuildState['auth'] })}
          options={authOptions}
          reason={reasonFor(result, 'auth')}
          reasonKind={reasonKindFor(result, 'auth')}
          selectedValue={state.auth ?? result.configuration.auth}
        />
        <ChoiceGroup
          id="trpc"
          label="API"
          onChange={(value) => updateState({ trpc: value as boolean })}
          options={trpcOptions}
          reason={reasonFor(result, 'trpc')}
          reasonKind={reasonKindFor(result, 'trpc')}
          selectedValue={state.trpc ?? result.configuration.trpc}
        />
        <ChoiceGroup
          id="mailer"
          label="Mailer"
          onChange={(value) => updateState({ mailer: value as BuildState['mailer'] })}
          options={mailerOptions}
          reason={reasonFor(result, 'mailer')}
          reasonKind={reasonKindFor(result, 'mailer')}
          selectedValue={state.mailer ?? result.configuration.mailer}
        />
      </div>
    </section>
  )
}

function CapabilityOption({
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

  function changeSelection(checked: boolean) {
    const capabilities = { ...state.capabilities }
    if (checked) capabilities[capability.name] = capability.recommendedProvider
    else delete capabilities[capability.name]
    updateState({ capabilities })
  }

  return (
    <div className="build-capability">
      <label className="build-capability-toggle">
        <input
          checked={selected}
          onChange={(event) => changeSelection(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          <strong>{capability.label}</strong>
          <small>{selected ? 'included' : 'not included'}</small>
        </span>
      </label>
      {selected ? (
        <label className="build-provider-field">
          <span>Provider</span>
          <select
            aria-label={`${capability.label} provider`}
            onChange={(event) =>
              updateState({
                capabilities: {
                  ...state.capabilities,
                  [capability.name]: event.currentTarget.value,
                },
              })
            }
            value={provider}
          >
            {capability.providers.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}

function AdditionalPanel({ state, updateState }: { state: BuildState; updateState: UpdateState }) {
  return (
    <details className="build-panel build-additional" open>
      <summary>
        <span>
          <span className="build-panel-index">03 / additional options</span>
          <strong>Extend the project</strong>
        </span>
        <span aria-hidden="true" className="build-summary-arrow">
          ↘
        </span>
      </summary>
      <div className="build-additional-body">
        <fieldset className="build-choice-group">
          <legend>Monorepo</legend>
          <div className="build-choice-options build-choice-options-wide">
            <label className="build-choice">
              <input
                checked={!state.monorepo}
                name="monorepo"
                onChange={() => updateState({ monorepo: undefined })}
                type="radio"
              />
              <span className="build-choice-copy">
                <strong>Single app</strong>
                <small>standalone project</small>
              </span>
            </label>
            {MONOREPOS.map((monorepo) => (
              <label className="build-choice" key={monorepo.value}>
                <input
                  checked={state.monorepo === monorepo.value}
                  name="monorepo"
                  onChange={() => updateState({ monorepo: monorepo.value })}
                  type="radio"
                />
                <span className="build-choice-copy">
                  <strong>{monorepo.label}</strong>
                  <small>app in apps/web</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="build-capabilities">
          <legend>Capabilities</legend>
          <p className="build-additional-copy">
            Add infrastructure now. Each capability uses the same provider choices as the CLI.
          </p>
          <div className="build-capability-grid">
            {CAPABILITY_CATALOG.map((capability) => (
              <CapabilityOption
                capability={capability}
                key={capability.name}
                state={state}
                updateState={updateState}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  )
}

function commandStatusMessage(result: BuildStateResult, copyState: 'idle' | 'copied' | 'error') {
  if (copyState === 'copied') return 'Command copied to your clipboard.'
  if (copyState === 'error') return copyFailureMessage()
  if (result.command) return 'Run it from the directory where you want the project.'
  return 'Command generation is paused until the conflicts are resolved.'
}

function CommandPanel({
  state,
  result,
  copyState,
  commandInput,
  updateState,
  copyCommand,
}: {
  state: BuildState
  result: BuildStateResult
  copyState: 'idle' | 'copied' | 'error'
  commandInput: React.RefObject<HTMLInputElement | null>
  updateState: UpdateState
  copyCommand: () => void
}) {
  return (
    <section aria-labelledby="command-heading" className="build-command-panel">
      <div className="build-command-heading">
        <div>
          <p className="build-panel-index">Ready to run</p>
          <h2 id="command-heading">Your command</h2>
        </div>
        <span className="build-command-status">non-interactive</span>
      </div>
      <div className="build-command-display">
        <span aria-hidden="true">$</span>
        <input
          aria-label="Generated Create Stack command"
          className="build-command-input"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          ref={commandInput}
          value={result.command ?? 'Resolve the choices above to continue'}
        />
      </div>
      <fieldset className="build-package-managers">
        <legend className="sr-only">Package manager</legend>
        {PACKAGE_MANAGERS.map((packageManager) => (
          <button
            aria-pressed={state.packageManager === packageManager}
            key={packageManager}
            onClick={() => updateState({ packageManager })}
            type="button"
          >
            {packageManager}
          </button>
        ))}
      </fieldset>
      <button
        className="build-primary-button"
        disabled={!result.command}
        onClick={copyCommand}
        type="button"
      >
        {copyState === 'copied' ? 'Command copied' : 'Copy command'}
      </button>
      <p className="build-command-status-message" data-state={copyState} role="status">
        {commandStatusMessage(result, copyState)}
      </p>
    </section>
  )
}

function ConflictPanel({ result }: { result: BuildStateResult }) {
  if (result.conflicts.length === 0) return null
  return (
    <section aria-labelledby="conflicts-heading" className="build-conflicts" role="alert">
      <p className="build-panel-index">Choice conflict</p>
      <h2 id="conflicts-heading">These choices cannot ship together.</h2>
      <ul>
        {result.conflicts.map((conflict) => (
          <li key={conflict.message}>{conflict.message}</li>
        ))}
      </ul>
    </section>
  )
}

function ReasonsPanel({ result }: { result: BuildStateResult }) {
  return (
    <section aria-labelledby="reasons-heading" className="build-reasons">
      <div className="build-reasons-heading">
        <p className="build-panel-index">Resolution notes</p>
        <h2 id="reasons-heading">Nothing changes silently.</h2>
      </div>
      <ul>
        {result.reasons.map((reason) => (
          <li data-kind={reason.kind} key={reason.axis}>
            <span>{reason.axis}</span>
            <strong>{String(reason.value)}</strong>
            <small>{reason.message}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SharePanel({
  shareState,
  copyShareLink,
}: {
  shareState: 'idle' | 'copied' | 'error'
  copyShareLink: () => void
}) {
  return (
    <section aria-labelledby="share-heading" className="build-share-panel">
      <div>
        <p className="build-panel-index">Share this stack</p>
        <h2 id="share-heading">Keep the choices in the URL.</h2>
      </div>
      <button className="build-share-button" onClick={copyShareLink} type="button">
        {shareState === 'copied' ? 'Link copied' : 'Copy share link'}
      </button>
      <p className="build-command-status-message" data-state={shareState} role="status">
        {shareState === 'copied'
          ? 'Anyone with this link can restore this configuration.'
          : shareState === 'error'
            ? copyFailureMessage()
            : 'The link updates as you make a choice.'}
      </p>
    </section>
  )
}

function BuildSidebar({
  state,
  result,
  copyState,
  shareState,
  commandInput,
  updateState,
  copyCommand,
  copyShareLink,
}: {
  state: BuildState
  result: BuildStateResult
  copyState: 'idle' | 'copied' | 'error'
  shareState: 'idle' | 'copied' | 'error'
  commandInput: React.RefObject<HTMLInputElement | null>
  updateState: UpdateState
  copyCommand: () => void
  copyShareLink: () => void
}) {
  return (
    <aside aria-label="Generated command and summary" className="build-sidebar">
      <CommandPanel
        commandInput={commandInput}
        copyCommand={copyCommand}
        copyState={copyState}
        result={result}
        state={state}
        updateState={updateState}
      />
      <ConflictPanel result={result} />
      <ReasonsPanel result={result} />
      <SharePanel copyShareLink={copyShareLink} shareState={shareState} />
    </aside>
  )
}

function BuildPage({
  state,
  result,
  copyState,
  shareState,
  commandInput,
  updateState,
  restoreRecommended,
  copyCommand,
  copyShareLink,
}: {
  state: BuildState
  result: BuildStateResult
  copyState: 'idle' | 'copied' | 'error'
  shareState: 'idle' | 'copied' | 'error'
  commandInput: React.RefObject<HTMLInputElement | null>
  updateState: UpdateState
  restoreRecommended: () => void
  copyCommand: () => void
  copyShareLink: () => void
}) {
  return (
    <main className="build-page page-shell">
      <div className="build-intro">
        <div>
          <p className="section-kicker">Build your stack</p>
          <h1>Choose the shape of your first useful commit.</h1>
          <p>
            Start from the same recommended stack as the CLI. Explicit choices stay explicit, while
            compatible omissions are completed with a reason you can see.
          </p>
        </div>
        <button className="build-reset-button" onClick={restoreRecommended} type="button">
          Reset to recommended
        </button>
      </div>

      <div className="build-layout">
        <section aria-label="Stack choices" className="build-form">
          <ProjectPanel state={state} updateState={updateState} />
          <StackPanel result={result} state={state} updateState={updateState} />
          <AdditionalPanel state={state} updateState={updateState} />
        </section>
        <BuildSidebar
          commandInput={commandInput}
          copyCommand={copyCommand}
          copyShareLink={copyShareLink}
          copyState={copyState}
          result={result}
          shareState={shareState}
          state={state}
          updateState={updateState}
        />
      </div>
    </main>
  )
}

export default function BuildConfigurator() {
  const [state, setState] = useState<BuildState>(() => defaultBuildState())
  const [route, setRoute] = useState<ParsedBuildState>(() => ({
    kind: 'current',
    state: defaultBuildState(),
  }))
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle')
  const commandInput = useRef<HTMLInputElement>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    function readUrl() {
      const parsed = parseBuildState(window.location.search)
      setRoute(parsed)
      if (parsed.kind === 'current') {
        stateRef.current = parsed.state
        setState(parsed.state)
        const canonicalSearch = serializeBuildState(parsed.state)
        if (window.location.search !== canonicalSearch) {
          window.history.replaceState(null, '', `${window.location.pathname}${canonicalSearch}`)
        }
      }
    }

    readUrl()
    window.addEventListener('popstate', readUrl)
    return () => window.removeEventListener('popstate', readUrl)
  }, [])

  const result = useMemo(() => resolveBuildState(state), [state])

  function updateState(patch: Partial<BuildState>) {
    const next = { ...stateRef.current, ...patch }
    stateRef.current = next
    setState(next)
    setRoute({ kind: 'current', state: next })
    window.history.replaceState(null, '', `${window.location.pathname}${serializeBuildState(next)}`)
    setCopyState('idle')
    setShareState('idle')
  }

  function restoreRecommended() {
    const next = defaultBuildState()
    stateRef.current = next
    setState(next)
    setRoute({ kind: 'current', state: next })
    window.history.replaceState(null, '', `${window.location.pathname}${serializeBuildState(next)}`)
    setCopyState('idle')
    setShareState('idle')
  }

  async function copyCommand() {
    if (!result.command) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(result.command)
      setCopyState('copied')
    } catch {
      setCopyState('error')
      requestAnimationFrame(() => {
        commandInput.current?.focus()
        commandInput.current?.select()
      })
    }
  }

  async function copyShareLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(window.location.href)
      setShareState('copied')
    } catch {
      setShareState('error')
    }
  }

  if (route.kind !== 'current') {
    return <BuildRecovery onRestore={restoreRecommended} route={route} />
  }

  return (
    <BuildPage
      commandInput={commandInput}
      copyCommand={copyCommand}
      copyShareLink={copyShareLink}
      copyState={copyState}
      restoreRecommended={restoreRecommended}
      result={result}
      shareState={shareState}
      state={state}
      updateState={updateState}
    />
  )
}
