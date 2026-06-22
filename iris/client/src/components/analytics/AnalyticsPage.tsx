import { useState } from 'react'
import { useTable } from 'spacetimedb/react'
import { tables } from '../../module_bindings'
import type { AnalyticsTab } from '../../types'
import { OverviewTab } from './OverviewTab'
import { PerformanceTab } from './PerformanceTab'
import { CategoriesTab } from './CategoriesTab'
import { EmployeesTab } from './EmployeesTab'

export function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('overview')

  const [overviewRows] = useTable(tables.analytics_overview)
  const [cats] = useTable(tables.inventory_categories)
  const [entries] = useTable(tables.stock_entries)
  const [movements] = useTable(tables.stock_movements)
  const [users] = useTable(tables.user)

  const [modelPerf1y] = useTable(tables.model_performance_1y)
  const [modelPerf3mo] = useTable(tables.model_performance_3mo)
  const [modelPerf6mo] = useTable(tables.model_performance_6mo)
  const [modelPerfAll] = useTable(tables.model_performance_all)

  const [catPeriod1y] = useTable(tables.category_period_breakdown_1y)
  const [catPeriod3mo] = useTable(tables.category_period_breakdown_3mo)
  const [catPeriod6mo] = useTable(tables.category_period_breakdown_6mo)
  const [catPeriodAll] = useTable(tables.category_period_breakdown_all)

  const [empActivity1y] = useTable(tables.employee_activity_1y)
  const [empActivity3mo] = useTable(tables.employee_activity_3mo)
  const [empActivity6mo] = useTable(tables.employee_activity_6mo)
  const [empActivityAll] = useTable(tables.employee_activity_all)

  const ov = overviewRows[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelPerfByWindow: Record<string, any> = { '1y': modelPerf1y[0], '3mo': modelPerf3mo[0], '6mo': modelPerf6mo[0], all: modelPerfAll[0] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catPeriodByWindow: Record<string, any> = { '1y': catPeriod1y[0], '3mo': catPeriod3mo[0], '6mo': catPeriod6mo[0], all: catPeriodAll[0] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeesByWindow: Record<string, any[]> = { '1y': empActivity1y as any[], '3mo': empActivity3mo as any[], '6mo': empActivity6mo as any[], all: empActivityAll as any[] }

  const userMap = new Map(users.map(u => [u.id.toHexString(), { name: u.name, email: u.email }]))

  return (
    <div className="page">
      <div className="page-header"><h2 className="page-title">Analytics</h2></div>
      <div className="analytics-controls">
        <div className="analytics-tab-bar">
          {(['overview', 'performance', 'categories', 'employees'] as AnalyticsTab[]).map(t => (
            <button key={t} className={`analytics-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'performance' ? 'Performance' : t === 'categories' ? 'Categories' : 'Employees'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' && <OverviewTab ov={ov} />}
      {tab === 'performance' && <PerformanceTab modelPerfByWindow={modelPerfByWindow} />}
      {tab === 'categories' && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <CategoriesTab cats={cats as any[]} entries={entries as any[]} movements={movements as any[]} catPeriodByWindow={catPeriodByWindow} userMap={userMap} />
      )}
      {tab === 'employees' && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <EmployeesTab employeesByWindow={employeesByWindow} entries={entries as any[]} movements={movements as any[]} userMap={userMap} />
      )}
    </div>
  )
}
