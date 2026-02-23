import { useEffect, useRef } from 'react'
import { useLeStudioStore } from '../../store'

interface LogConsoleProps {
  processName: string
}

export function LogConsole({ processName }: LogConsoleProps) {
  const lines = useLeStudioStore((s) => s.logLines[processName] ?? [])
  const elRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div className="terminal" ref={elRef}>
      {lines.map((line) => (
        <div key={line.id} className={`line-${line.kind}`}>
          {line.text}
        </div>
      ))}
    </div>
  )
}
