interface ProcessButtonsProps {
  running: boolean
  onStart: () => void
  onStop: () => void
  startLabel: string
}

export function ProcessButtons({ running, onStart, onStop, startLabel }: ProcessButtonsProps) {
  return (
    <div className="btn-row">
      {!running ? (
        <button className="btn-primary" onClick={onStart}>
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
