import { useCallback, useEffect, useRef, useState } from 'react'
import { useLeStudioStore } from '../../store'
import type { LogLine } from '../../lib/types'

const PROCESSES = ['teleop', 'record', 'calibrate', 'motor_setup', 'train', 'eval'] as const
const TAB_TO_PROCESS: Record<string, string> = {
  teleop: 'teleop',
  record: 'record',
  calibrate: 'calibrate',
  'motor-setup': 'motor_setup',
  train: 'train',
  eval: 'eval',
}

const EMPTY_LINES: LogLine[] = []

export function ConsoleDrawer() {
  const [collapsed, setCollapsed] = useState(true)
  const [selectedProcess, setSelectedProcess] = useState<string>('teleop')
  const [stdinValue, setStdinValue] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  const lines = useLeStudioStore((s) => s.logLines[selectedProcess] ?? EMPTY_LINES)
  const procStatus = useLeStudioStore((s) => s.procStatus)
  const activeTab = useLeStudioStore((s) => s.activeTab)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const addToast = useLeStudioStore((s) => s.addToast)

  const running = selectedProcess === 'train'
    ? !!(procStatus.train || procStatus.train_install)
    : !!procStatus[selectedProcess]
  const processState = running ? 'RUNNING' : 'IDLE'
  const stateBadgeClass = running ? 'badge-run' : 'badge-idle'

  /* auto-scroll to bottom */
  useEffect(() => {
    if (logRef.current && !collapsed) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [lines, collapsed])

  useEffect(() => {
    const mapped = TAB_TO_PROCESS[activeTab]
    if (!mapped) return
    setSelectedProcess((prev) => (prev === mapped ? prev : mapped))
  }, [activeTab])

  const sendInput = useCallback(async () => {
    try {
      const res = await fetch(`/api/process/${selectedProcess}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: stdinValue }),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      setStdinValue('')
    } catch (err) {
      addToast(`Failed to send input: ${String(err)}`, 'error')
    }
  }, [addToast, selectedProcess, stdinValue])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendInput()
    }
  }

  return (
    <section
      id="console-drawer"
      className={`console-drawer ${collapsed ? 'collapsed' : ''}`}
      aria-label="Global Console Drawer"
    >
      <div className="console-drawer-header">
        <div
          className="console-controls"
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: 'pointer' }}
        >
          <span className="console-title">Console</span>
          <span className="console-chevron">▼</span>
          <select
            className="console-process-select"
            value={selectedProcess}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setSelectedProcess(e.target.value)}
          >
            {PROCESSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className={`dbadge ${stateBadgeClass}`}>{processState}</span>
        </div>
        <div className="console-actions">
          <button
            className="btn-xs"
            onClick={(e) => {
              e.stopPropagation()
              clearLog(selectedProcess)
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="console-drawer-body">
          <div id="console-log" className="terminal" ref={logRef}>
            {lines.map((line) => (
              <div
                key={line.id}
                className={
                  line.kind === 'stderr' || line.kind === 'error'
                    ? 'line-error'
                    : line.kind === 'info'
                      ? 'line-info'
                      : 'line-stdout'
                }
              >
                {line.text}
              </div>
            ))}
            {lines.length === 0 && (
              <div className="line-stdout" style={{ opacity: 0.5 }}>
                No output yet. Start a process to see logs here.
              </div>
            )}
          </div>
          <div className="stdin-row">
            <input
              type="text"
              placeholder="Send input to selected process"
              value={stdinValue}
              onChange={(e) => setStdinValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn-sm" onClick={sendInput}>
              Send ↵
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
