import { STATUS_COLORS } from '../../types'
import { formatCurrency } from '../../helpers'
import { DonutChart } from '../Charts'
import { Icon } from '../Icon'
import { StatCard } from './StatCard'
import { buildGeneralCsv, downloadCsv } from './csv'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OverviewTab({ ov }: { ov: any }) {
  if (!ov) return <div className="empty-state">No data yet. Items will appear once processed.</div>

  const totalItems = ov.shelfCount + ov.storageCount + ov.soldCount
  const totalActive = ov.shelfValue + ov.storageValue

  const statusDonut = [
    { value: ov.shelfCount, color: STATUS_COLORS.Shelf, label: 'Shelf' },
    { value: ov.storageCount, color: STATUS_COLORS.Storage, label: 'Storage' },
    { value: ov.soldCount, color: STATUS_COLORS.Sold, label: 'Sold' },
  ]

  function handleCsv() {
    const csv = buildGeneralCsv(ov)
    downloadCsv(`iris-overview-${Date.now()}.csv`, csv)
  }

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-header">
          <div>
            <div className="analytics-section-title">Right Now</div>
            <div className="analytics-section-desc">Current state of your inventory, regardless of timeframe.</div>
          </div>
          <button className="csv-btn" onClick={handleCsv}>
            <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} />
            Export CSV
          </button>
        </div>
        <div className="stat-row">
          <StatCard label="Total Items" value={String(totalItems)} />
          <StatCard label="Active Value" value={formatCurrency(totalActive)} sub="shelf + storage" />
          <StatCard label="All-Time Revenue" value={formatCurrency(ov.soldValue)} sub="from sold items" />
          <StatCard label="Pending Review" value={String(ov.pendingReview)} />
          <StatCard label="Active Categories" value={String(ov.activeCategories)} />
          <StatCard label="Employees" value={String(ov.totalEmployees)} />
        </div>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-title">Inventory by Status</div>
        <div className="analytics-section-desc">Distribution of items across each status, right now.</div>
        <div className="status-layout">
          <div>
            <DonutChart data={statusDonut} size={150} thickness={18} center={String(totalItems)} />
            <div className="donut-legend" style={{ marginTop: 14 }}>
              {statusDonut.map(s => (
                <div key={s.label} className="legend-item">
                  <span className="legend-dot" style={{ background: s.color }} />
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-val">{s.value} items</span>
                </div>
              ))}
            </div>
          </div>
          <div className="status-cols">
            {([
              { key: 'shelf' as const, label: 'Shelf', color: STATUS_COLORS.Shelf, count: ov.shelfCount, value: ov.shelfValue },
              { key: 'storage' as const, label: 'Storage', color: STATUS_COLORS.Storage, count: ov.storageCount, value: ov.storageValue },
              { key: 'sold' as const, label: 'Sold', color: STATUS_COLORS.Sold, count: ov.soldCount, value: ov.soldValue },
            ]).map(s => (
              <div key={s.key} className="status-col">
                <div className="status-col-header">
                  <span className="status-dot" style={{ background: s.color }} />
                  <span className="status-col-name">{s.label}</span>
                </div>
                <div className="status-col-count">{s.count}</div>
                <div className="status-col-value">{formatCurrency(s.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
