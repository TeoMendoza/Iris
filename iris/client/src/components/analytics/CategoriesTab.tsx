import { useState } from 'react'
import { CATEGORY_TIME_WINDOWS, CATEGORY_COLORS } from '../../types'
import type { TimeWindow, CategoryTag } from '../../types'
import { formatCurrency, avgItemValue } from '../../helpers'
import { Icon } from '../Icon'
import { TimeframeSelector } from './TimeframeSelector'
import { buildCategoryAddsCsv, buildCategoryMovesCsv, buildCategorySummaryCsv, downloadCsv } from './csv'
import type { UserMap } from './csv'

function catKey(tag: string): string {
  return tag.toLowerCase()
}

const WINDOW_LABEL: Record<TimeWindow, string> = { '1y': '1 Year', '3mo': '3 Months', '6mo': '6 Months', all: 'All Time', now: 'Now' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CategoriesTab({ cats, entries, movements, catPeriodByWindow, userMap }: { cats: any[]; entries: any[]; movements: any[]; catPeriodByWindow: Record<string, any>; userMap: UserMap }) {
  const [window, setWindow] = useState<TimeWindow>('now')
  const isNow = window === 'now'
  const catPeriod = catPeriodByWindow[window]

  const active = [...cats]
    .filter((c: { shelfCount: number; storageCount: number; soldCount: number }) => c.shelfCount + c.storageCount + c.soldCount > 0)
    .sort((a: { totalValue: number }, b: { totalValue: number }) => b.totalValue - a.totalValue)

  function handleStockLogCsv() {
    const csv = buildCategorySummaryCsv(active, catPeriod, window)
    downloadCsv(`iris-category-summary-${window}-${Date.now()}.csv`, csv)
  }

  function handleCategoryAddsCsv(tag: CategoryTag) {
    const csv = buildCategoryAddsCsv(entries, tag, window, userMap)
    downloadCsv(`iris-category-adds-${tag}-${window}-${Date.now()}.csv`, csv)
  }

  function handleCategoryMovesCsv(tag: CategoryTag) {
    const csv = buildCategoryMovesCsv(movements, tag, window, userMap)
    downloadCsv(`iris-category-moves-${tag}-${window}-${Date.now()}.csv`, csv)
  }

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div>
          <div className="analytics-section-title">Category Breakdown</div>
          <div className="analytics-section-desc">{isNow ? 'Current snapshot, right now.' : `Activity in the selected period (${WINDOW_LABEL[window]}).`}</div>
        </div>
        <div className="csv-export-group">
          <TimeframeSelector window={window} setWindow={setWindow} options={CATEGORY_TIME_WINDOWS} />
          <button className="csv-btn" onClick={handleStockLogCsv}>
            <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} />
            Category Summary CSV
          </button>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="empty-state">No inventory yet.</div>
      ) : (
        <div className="cat-analytics-list">
          {active.map((c: { id: unknown; category: { tag: CategoryTag }; shelfCount: number; storageCount: number; soldCount: number; totalValue: number }) => {
            const total = c.shelfCount + c.storageCount + c.soldCount
            const avg = avgItemValue(c as never)
            const activeValue = avg * (c.shelfCount + c.storageCount)
            const soldValue = avg * c.soldCount
            const sellThrough = total > 0 ? (c.soldCount / total * 100) : 0
            const color = CATEGORY_COLORS[c.category.tag] ?? '#94a3b8'
            const period = catPeriod?.[catKey(c.category.tag)]

            return (
              <div key={String(c.id)} className="cat-analytics-row">
                <div className="cat-analytics-row-header">
                  <div className="cat-color-dot" style={{ background: color }} />
                  <span className="cat-analytics-row-name">{c.category.tag}</span>
                  <span className="cat-analytics-row-total">{total} items</span>
                </div>

                {isNow ? (
                  <div className="cat-detail-stats">
                    <div className="cat-stat">
                      <div className="cat-stat-label">On Shelf</div>
                      <div className="cat-stat-value">{c.shelfCount}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">In Storage</div>
                      <div className="cat-stat-value">{c.storageCount}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Sold</div>
                      <div className="cat-stat-value">{c.soldCount}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Avg Value</div>
                      <div className="cat-stat-value">{formatCurrency(avg)}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Active Value</div>
                      <div className="cat-stat-value">{formatCurrency(activeValue)}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Revenue</div>
                      <div className="cat-stat-value">{formatCurrency(soldValue)}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Sell-through</div>
                      <div className="cat-stat-value">{sellThrough.toFixed(0)}%</div>
                    </div>
                  </div>
                ) : period ? (
                  <div className="cat-detail-stats">
                    <div className="cat-stat">
                      <div className="cat-stat-label">Items Added</div>
                      <div className="cat-stat-value">{period.itemsAdded}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Added Value</div>
                      <div className="cat-stat-value">{formatCurrency(period.itemsAddedValue)}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Items Sold</div>
                      <div className="cat-stat-value">{period.itemsSold}</div>
                    </div>
                    <div className="cat-stat">
                      <div className="cat-stat-label">Sold Value</div>
                      <div className="cat-stat-value">{formatCurrency(period.itemsSoldValue)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '8px 0' }}>No activity in this period.</div>
                )}

                <div className="cat-analytics-row-csv" style={{ marginTop: 12 }}>
                  <button className="csv-btn-sm" onClick={() => handleCategoryAddsCsv(c.category.tag)}>
                    <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={12} />
                    Adds CSV
                  </button>
                  <button className="csv-btn-sm" onClick={() => handleCategoryMovesCsv(c.category.tag)}>
                    <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={12} />
                    Moves CSV
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
