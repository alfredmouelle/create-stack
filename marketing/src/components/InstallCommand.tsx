import { PACKAGE_MANAGERS, type PackageManagerName } from '@alfredmouelle/stack-config'
import { useEffect, useRef, useState } from 'react'
import { captureCommandCopied } from '../lib/analytics'
import { installCommand } from '../lib/install-command'

type CopyState = 'idle' | 'copied' | 'error'

const STATUS_MESSAGES = {
  idle: 'No account required. Change my-app before you run it.',
  copied: 'Command copied to your clipboard.',
  error: 'Copy unavailable. Select the command, then press Ctrl+C or Cmd+C.',
} as const satisfies Record<CopyState, string>

export default function InstallCommand() {
  const commandInput = useRef<HTMLInputElement>(null)
  const [packageManager, setPackageManager] = useState<PackageManagerName>('pnpm')
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
      captureCommandCopied({ source: 'hero', packageManager })
    } catch {
      setCopyState('error')
      requestAnimationFrame(() => {
        commandInput.current?.focus()
        commandInput.current?.select()
      })
    }
  }

  return (
    <div className="install">
      <div className="cmd">
        <fieldset className="pm-switch">
          <legend className="sr-only">Package manager</legend>
          {PACKAGE_MANAGERS.map((manager) => (
            <button
              aria-pressed={packageManager === manager}
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
        <div className="cmd-line" data-overflowing={isCommandOverflowing}>
          <span aria-hidden="true" className="cmd-prompt">
            $
          </span>
          <input
            aria-label="Create Stack install command"
            className="cmd-input"
            id="install-command"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            ref={commandInput}
            title="Scroll horizontally to inspect the full command"
            value={command}
          />
          <span aria-hidden="true" className="cmd-scroll-cue">
            ↔
          </span>
          <button
            className="copy-button"
            data-state={copyState}
            onClick={copyCommand}
            type="button"
          >
            {copyState === 'copied' ? 'Copied ✓' : 'Copy command'}
          </button>
        </div>
      </div>
      <p aria-live="polite" className="install-status" data-state={copyState} role="status">
        {STATUS_MESSAGES[copyState]}
      </p>
    </div>
  )
}
