import { useEffect, useRef, useState } from 'react'
import { captureCommandCopied } from '../lib/analytics'
import { installCommand, PACKAGE_MANAGERS, type PackageManager } from '../lib/install-command'

type CopyState = 'idle' | 'copied' | 'error'

export default function InstallCommand() {
  const commandInput = useRef<HTMLInputElement>(null)
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [isCommandOverflowing, setIsCommandOverflowing] = useState(false)
  const command = installCommand(packageManager)

  useEffect(() => {
    const input = commandInput.current
    if (!input) return

    const updateOverflow = () => {
      if (input.value !== command) return
      setIsCommandOverflowing(input.scrollWidth > input.clientWidth + 1)
    }

    updateOverflow()
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(input)
    return () => observer.disconnect()
  }, [command])

  async function copyCommand() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(command)
      setCopyState('copied')
      captureCommandCopied({
        source: 'hero',
        packageManager,
      })
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
        <span aria-hidden="true" className="terminal-window">
          <i />
          <i />
          <i />
        </span>
        <span className="command-label-title" id="install-heading">
          create-stack / install
        </span>
      </div>
      <div className="command-body">
        <p className="command-intro">Run this command to create the project.</p>
        <label
          className="command-line"
          data-overflowing={isCommandOverflowing}
          htmlFor="install-command"
        >
          <span aria-hidden="true" className="command-prompt">
            ${' '}
          </span>
          <input
            aria-label="Create Stack install command"
            id="install-command"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            ref={commandInput}
            title="Scroll horizontally to inspect the full command"
            value={command}
          />
          <span aria-hidden="true" className="command-scroll-cue">
            ↔
          </span>
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
