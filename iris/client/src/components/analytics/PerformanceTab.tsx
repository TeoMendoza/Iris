import { useState } from 'react'
import { TIME_WINDOWS } from '../../types'
import type { TimeWindow } from '../../types'
import { DonutChart } from '../Charts'
import { Icon } from '../Icon'
import { StatCard } from './StatCard'
import { TimeframeSelector } from './TimeframeSelector'
import { buildPerformanceCsv, downloadCsv } from './csv'

const WINDOW_LABEL: Record<TimeWindow, string> = { '1y': '1 Year', '3mo': '3 Months', '6mo': '6 Months', all: 'All Time', now: 'Now' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PerformanceTab({ modelPerfByWindow }: { modelPerfByWindow: Record<string, any> }) {
  const [window, setWindow] = useState<TimeWindow>('1y')
  const modelPerf = modelPerfByWindow[window]

  const noPerf = !modelPerf || modelPerf.totalProcessed === 0
  const catPct = modelPerf?.categoryAccuracyPct ?? 0
  const catDonut = [
    { value: catPct, color: '#2d7d46', label: 'Correct' },
    { value: Math.max(0, 100 - catPct), color: 'rgba(100,80,160,0.12)', label: 'Incorrect' },
  ]

  function handlePerformanceCsv() {
    if (!modelPerf) return
    const csv = buildPerformanceCsv(modelPerf, window)
    downloadCsv(`iris-performance-${window}-${Date.now()}.csv`, csv)
  }

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div>
          <div className="analytics-section-title">AI Model Performance ({WINDOW_LABEL[window]})</div>
          <div className="analytics-section-desc">Compares what the AI predicted to what employees confirmed after review.</div>
        </div>
        <div className="csv-export-group">
          <TimeframeSelector window={window} setWindow={setWindow} options={TIME_WINDOWS} />
          <button className="csv-btn" onClick={handlePerformanceCsv} disabled={noPerf}>
            <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {noPerf ? (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          No confirmed items yet in this period. Stats appear once items are reviewed.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 20 }}>
            Based on {modelPerf.totalProcessed} scan{modelPerf.totalProcessed !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              <DonutChart data={catDonut} size={130} thickness={16} center={`${catPct.toFixed(0)}%`} />
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Category Accuracy</div>
            </div>
            <div className="stat-row" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Rejection Rate" value={`${modelPerf.rejectionRatePct.toFixed(1)}%`} sub="scans rejected by employees" />
              <StatCard label="Avg Count Error" value={`${modelPerf.avgCountDeltaPct.toFixed(1)}%`} sub="how far off item counts were" />
              <StatCard label="Avg Value Error" value={`${modelPerf.avgValueDeltaPct.toFixed(1)}%`} sub="how far off value estimates were" />
              <StatCard label="Missed Items" value={String(modelPerf.missedCount)} sub="reported via branch-off" />
              <StatCard label="Missed Rate" value={`${modelPerf.missedRatePct.toFixed(1)}%`} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
