interface ProcessButtonsProps {
  running: boolean
  onStart: () => void
  onStop: () => void
  startLabel: string
  disabled?: boolean
}

export function ProcessButtons({ running, onStart, onStop, startLabel, disabled }: ProcessButtonsProps) {
  return (
    <div className="btn-row">
      {!running ? (
        <button className="btn-primary" onClick={onStart} disabled={disabled}>
          {startLabel}
        </button>
      ) : (
        <button className="btn-danger" onClick={onStop}>
          ■ Stop
        </button>
      )}
    </div>
  )
}
