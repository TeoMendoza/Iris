import type { TimeWindow } from '../../types'

export function TimeframeSelector({ window, setWindow, options }: { window: TimeWindow; setWindow: (w: TimeWindow) => void; options: { key: TimeWindow; label: string }[] }) {
  return (
    <div className="timeframe-selector">
      {options.map(w => (
        <button key={w.key} className={`timeframe-btn${window === w.key ? ' active' : ''}`} onClick={() => setWindow(w.key)}>
          {w.label}
        </button>
      ))}
    </div>
  )
}
