import { useState } from 'react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'
import { tables } from '../../module_bindings'
import { CATEGORIES, CATEGORY_COLORS } from '../../types'
import type { CategoryTag } from '../../types'
import { ItemImage } from '../ItemImage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewCard({ item }: { item: any }) {
  const { getConnection } = useSpacetimeDB()
  const [category, setCategory] = useState<CategoryTag>(item.predictedCategory.tag)
  const [count, setCount] = useState<string>(String(item.predictedCount))
  const [totalValue, setTotalValue] = useState<string>(String(item.predictedTotalValue))

  function handleApprove() {
    getConnection()?.reducers.approveReviewItem({
      reviewItemId: item.id,
      category: { tag: category },
      count: parseInt(count) || 0,
      totalValue: Math.round(parseFloat(totalValue) || 0),
    })
  }

  function handleReject() {
    getConnection()?.reducers.rejectReviewItem({ reviewItemId: item.id })
  }

  function handleBranch() {
    getConnection()?.reducers.branchReviewItem({ sourceReviewItemId: item.id })
  }

  const avg = Math.round((parseFloat(totalValue) || 0) / Math.max(parseInt(count) || 1, 1))

  return (
    <div className="review-card">
      <div className="img-wrap">
        <ItemImage bytes={item.imageBytes} className="review-card-img" />
      </div>

      <div className="review-card-prediction">
        <span className="pred-label">{item.wasBranched ? 'Manually added' : 'AI detected'}</span>
        {!item.wasBranched && (
          <>
            <span className="pred-tag" style={{ background: `${CATEGORY_COLORS[item.predictedCategory.tag]}20`, color: CATEGORY_COLORS[item.predictedCategory.tag], borderColor: `${CATEGORY_COLORS[item.predictedCategory.tag]}40` }}>{item.predictedCategory.tag}</span>
            <span className="pred-tag">{item.predictedCount}x</span>
            <span className="pred-price">${item.predictedTotalValue}</span>
          </>
        )}
      </div>

      <div className="review-card-fields">
        <div className="field">
          <span className="field-label">Category</span>
          <select value={category} onChange={e => setCategory(e.target.value as CategoryTag)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="review-count-value">
          <div className="field">
            <span className="field-label">Count</span>
            <input type="number" value={count} onChange={e => setCount(e.target.value)} min="1" step="1" />
          </div>
          <div className="field">
            <span className="field-label">Total Value</span>
            <div className="price-wrap">
              <span className="currency">$</span>
              <input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} min="0" step="1" />
            </div>
          </div>
        </div>
        {parseFloat(totalValue) > 0 && parseInt(count) > 1 && (
          <div className="review-avg">${avg} avg per item</div>
        )}
      </div>

      <div className="review-card-actions">
        <button className="btn btn-reject" onClick={handleReject}>Reject</button>
        <button className="btn btn-approve" onClick={handleApprove}>Approve</button>
      </div>

      <button className="branch-off-toggle" onClick={handleBranch}>+ Add missed item</button>
    </div>
  )
}

export function ReviewQueue() {
  const [items] = useTable(tables.review_queue)

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Review Queue</h2>
        {items.length > 0 && <span className="page-count">{items.length} pending</span>}
      </div>
      {items.length === 0 ? (
        <div className="empty-state">No items waiting for review.</div>
      ) : (
        <div className="review-card-grid">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(items as any[]).map(item => <ReviewCard key={String(item.id)} item={item} />)}
        </div>
      )}
    </div>
  )
}
