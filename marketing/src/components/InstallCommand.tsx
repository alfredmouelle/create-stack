import { useRef, useState } from 'react'
import { installCommand, PACKAGE_MANAGERS, type PackageManager } from '../lib/install-command'

type CopyState = 'idle' | 'copied' | 'error'

export default function InstallCommand() {
  const commandInput = useRef<HTMLInputElement>(null)
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const command = installCommand(packageManager)

  async function copyCommand() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(command)
      setCopyState('copied')
    } catch {
      setCopyState('error')
      requestAnimationFrame(() => {
        commandInput.current?.focus()
        commandInput.current?.select()
      })
    }
  }

  return (
    <section aria-labelledby="install-heading" className="command-card">
      <div className="command-label">
        <span id="install-heading">Start with a project</span>
        <span aria-hidden="true" />
      </div>
      <div className="command-body">
        <p className="command-intro">Run this command to create the project.</p>
        <label className="command-line" htmlFor="install-command">
          <span aria-hidden="true" className="command-prompt">
            ${' '}
          </span>
          <input
            aria-label="Create Stack install command"
            id="install-command"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            ref={commandInput}
            value={command}
          />
        </label>
        <div className="command-actions">
          <fieldset aria-label="Package manager" className="manager-group">
            <legend className="sr-only">Package manager</legend>
            {PACKAGE_MANAGERS.map((manager) => (
              <button
                aria-pressed={packageManager === manager}
                className="manager-button"
                key={manager}
                onClick={() => {
                  setPackageManager(manager)
                  setCopyState('idle')
                }}
                type="button"
              >
                {manager}
              </button>
            ))}
          </fieldset>
          <button
            className="copy-button"
            data-state={copyState}
            onClick={copyCommand}
            type="button"
          >
            <span aria-hidden="true">{copyState === 'copied' ? '✓' : '↗'}</span>
            {copyState === 'copied' ? 'Copied' : 'Copy command'}
          </button>
        </div>
        <p aria-live="polite" className="copy-status" data-state={copyState} role="status">
          {copyState === 'copied'
            ? 'Command copied to your clipboard.'
            : copyState === 'error'
              ? 'Copy unavailable. Select the command, then press Ctrl+C or Cmd+C.'
              : 'No account required. Change my-app before you run it.'}
        </p>
      </div>
    </section>
  )
}
