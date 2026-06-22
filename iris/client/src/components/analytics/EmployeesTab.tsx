import { useState } from 'react'
import { TIME_WINDOWS } from '../../types'
import type { TimeWindow } from '../../types'
import { Icon } from '../Icon'
import { TimeframeSelector } from './TimeframeSelector'
import { buildEmployeeApprovalsCsv, buildEmployeeMovesCsv, buildEmployeesCsv, downloadCsv } from './csv'
import type { UserMap } from './csv'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EmployeesTab({ employeesByWindow, entries, movements, userMap }: { employeesByWindow: Record<string, any[]>; entries: any[]; movements: any[]; userMap: UserMap }) {
  const [window, setWindow] = useState<TimeWindow>('1y')
  const employees = employeesByWindow[window] ?? []

  function handleCsv() {
    const csv = buildEmployeesCsv(employees, window, userMap)
    downloadCsv(`iris-employees-${window}-${Date.now()}.csv`, csv)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleApprovalsCsv(identity: any) {
    const csv = buildEmployeeApprovalsCsv(entries, identity, window, userMap)
    downloadCsv(`iris-employee-approvals-${window}-${Date.now()}.csv`, csv)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleMovesCsv(identity: any) {
    const csv = buildEmployeeMovesCsv(movements, identity, window, userMap)
    downloadCsv(`iris-employee-moves-${window}-${Date.now()}.csv`, csv)
  }

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div>
          <div className="analytics-section-title">Employee Activity</div>
          <div className="analytics-section-desc">What each employee did within the selected period.</div>
        </div>
        <div className="csv-export-group">
          <TimeframeSelector window={window} setWindow={setWindow} options={TIME_WINDOWS} />
          <button className="csv-btn" onClick={handleCsv} disabled={employees.length === 0}>
            <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">No employee activity in this period.</div>
      ) : (
        <div className="employee-list">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {employees.map((e: any, i: number) => (
            <div key={i} className="employee-row">
              <div className="employee-row-name">{e.name}</div>
              <div className="employee-row-metrics">
                <div className="employee-metric">
                  <div className="employee-metric-label">Items Approved</div>
                  <div className="employee-metric-value">{e.itemsApproved}</div>
                </div>
                <div className="employee-metric">
                  <div className="employee-metric-label">Scans Submitted</div>
                  <div className="employee-metric-value">{e.scansSubmitted}</div>
                </div>
                <div className="employee-metric">
                  <div className="employee-metric-label">Moves Performed</div>
                  <div className="employee-metric-value">{e.movesPerformed}</div>
                </div>
                <div className="employee-metric">
                  <div className="employee-metric-label">Missed Items</div>
                  <div className="employee-metric-value">{e.missedItemsReported}</div>
                </div>
              </div>
              <div className="employee-row-actions">
                <button className="csv-btn-sm" onClick={() => handleApprovalsCsv(e.identity)}>Approvals CSV</button>
                <button className="csv-btn-sm" onClick={() => handleMovesCsv(e.identity)}>Moves CSV</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
