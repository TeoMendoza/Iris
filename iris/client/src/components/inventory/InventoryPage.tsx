import { useState } from 'react'
import { useTable, useSpacetimeDB } from 'spacetimedb/react'
import { tables } from '../../module_bindings'
import { CATEGORIES, CATEGORY_COLORS, STATUSES } from '../../types'
import type { CategoryTag, StatusTag } from '../../types'
import { CategoryIcon } from '../Icon'

type MoveStep = 'pick-from' | 'pick-from-status' | 'pick-to' | 'pick-to-status' | 'confirm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countFor(cat: any, status: StatusTag): number {
  if (status === 'Shelf') return cat.shelfCount
  if (status === 'Storage') return cat.storageCount
  return cat.soldCount
}

function CategoryCard({
  cat, moveMode, step, isFrom, isTo, onPickCategory, onPickStatus,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cat: any
  moveMode: boolean
  step: MoveStep
  isFrom: boolean
  isTo: boolean
  onPickCategory: (tag: CategoryTag) => void
  onPickStatus: (tag: CategoryTag, status: StatusTag) => void
}) {
  const tag = cat.category.tag as CategoryTag
  const color = CATEGORY_COLORS[tag] ?? '#94a3b8'

  const fromActive = moveMode && step === 'pick-from-status' && isFrom
  const toActive = moveMode && step === 'pick-to-status' && isTo
  const statusPicking = fromActive || toActive
  const clickable = moveMode && (step === 'pick-from' || step === 'pick-from-status' || step === 'pick-to' || step === 'pick-to-status')
  const dimmed = moveMode && (step === 'pick-from-status' || step === 'pick-to-status') && !statusPicking

  return (
    <div
      className={['cat-card', clickable ? 'cat-card-selectable' : '', isFrom ? 'cat-card-from' : '', isTo ? 'cat-card-to' : '', dimmed ? 'cat-card-dimmed' : ''].filter(Boolean).join(' ')}
      onClick={clickable ? () => onPickCategory(tag) : undefined}
    >
      <div className="cat-card-img-wrap">
        <div className="cat-card-img-placeholder" style={{ background: `${color}18`, color }}>
          <CategoryIcon tag={tag} size={36} />
        </div>
        {(isFrom || isTo) && <span className={`cat-card-role-badge ${isFrom ? 'from' : 'to'}`}>{isFrom ? 'FROM' : 'TO'}</span>}
      </div>
      <div className="cat-card-body">
        <div className="cat-card-name">{tag}</div>
        <div className="cat-card-stats">
          {STATUSES.map((status) => {
            const value = countFor(cat, status)
            const chipClickable = statusPicking && (!fromActive || value > 0)
            return (
              <div
                key={status}
                className={[
                  'cat-card-stat', `cat-card-stat-${status.toLowerCase()}`,
                  chipClickable ? 'cat-card-stat-selectable' : '',
                  statusPicking && !chipClickable ? 'cat-card-stat-disabled' : '',
                ].filter(Boolean).join(' ')}
                onClick={chipClickable ? (e) => { e.stopPropagation(); onPickStatus(tag, status) } : undefined}
              >
                <div className="cat-card-stat-label">{status}</div>
                <div className="cat-card-stat-value">{value}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function InventoryPage() {
  const [cats] = useTable(tables.inventory_categories)
  const { getConnection } = useSpacetimeDB()

  const [moveMode, setMoveMode] = useState(false)
  const [step, setStep] = useState<MoveStep>('pick-from')
  const [fromCategory, setFromCategory] = useState<CategoryTag | null>(null)
  const [fromStatus, setFromStatus] = useState<StatusTag | null>(null)
  const [toCategory, setToCategory] = useState<CategoryTag | null>(null)
  const [toStatus, setToStatus] = useState<StatusTag | null>(null)
  const [count, setCount] = useState('1')
  const [error, setError] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = [...cats].sort((a: any, b: any) => CATEGORIES.indexOf(a.category.tag) - CATEGORIES.indexOf(b.category.tag))

  function resetSelection() {
    setStep('pick-from')
    setFromCategory(null)
    setFromStatus(null)
    setToCategory(null)
    setToStatus(null)
    setCount('1')
    setError('')
  }

  function toggleMoveMode() {
    setMoveMode((m) => !m)
    resetSelection()
  }

  function handlePickCategory(tag: CategoryTag) {
    setError('')
    if (step === 'pick-from' || step === 'pick-from-status') {
      setFromCategory(tag)
      setFromStatus(null)
      setStep('pick-from-status')
    } else if (step === 'pick-to' || step === 'pick-to-status') {
      setToCategory(tag)
      setToStatus(null)
      setStep('pick-to-status')
    }
  }

  function handlePickStatus(tag: CategoryTag, status: StatusTag) {
    setError('')
    if (step === 'pick-from-status' && tag === fromCategory) {
      setFromStatus(status)
      setStep('pick-to')
    } else if (step === 'pick-to-status' && tag === toCategory) {
      if (tag === fromCategory && status === fromStatus) { setError('Pick a different category or status for the destination.'); return }
      setToStatus(status)
      setStep('confirm')
    }
  }

  function handleConfirm() {
    const n = parseInt(count) || 0
    if (n <= 0) { setError('Enter a valid count'); return }
    if (!fromCategory || !fromStatus || !toCategory || !toStatus) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromCat = cats.find((c: any) => c.category.tag === fromCategory)
    const available = fromCat ? countFor(fromCat, fromStatus) : 0
    if (n > available) { setError(`Only ${available} available in ${fromCategory} / ${fromStatus}`); return }
    setError('')
    getConnection()?.reducers.moveStock({
      fromCategory: { tag: fromCategory },
      fromStatus: { tag: fromStatus },
      toCategory: { tag: toCategory },
      toStatus: { tag: toStatus },
      count: n,
    }).then(() => resetSelection()).catch((err: Error) => setError(err.message))
  }

  const stepHint =
    step === 'pick-from' ? 'Click a category to move FROM.' :
    step === 'pick-from-status' ? `Click a status on ${fromCategory} to move FROM.` :
    step === 'pick-to' ? 'Click a category to move TO.' :
    step === 'pick-to-status' ? `Click a status on ${toCategory} to move TO.` :
    'Set a quantity and confirm.'

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Inventory</h2>
        <span className="page-count">{cats.length} categories</span>
      </div>

      <div className="move-toolbar">
        <button className={`btn-move-toggle${moveMode ? ' active' : ''}`} onClick={toggleMoveMode}>
          {moveMode ? 'Cancel Move' : 'Move Stock'}
        </button>
        {moveMode && step !== 'confirm' && <span className="move-toolbar-hint">{stepHint}</span>}
        {moveMode && (fromCategory || toCategory) && <button className="move-toolbar-reset" onClick={resetSelection}>Start Over</button>}
      </div>

      {moveMode && step === 'confirm' && fromCategory && fromStatus && toCategory && toStatus && (
        <div className="move-confirm-bar">
          <span className="move-confirm-text">Move <strong>{fromCategory}</strong> / {fromStatus} → <strong>{toCategory}</strong> / {toStatus}</span>
          <input type="number" className="move-count-input" value={count} onChange={(e) => setCount(e.target.value)} min="1" placeholder="Qty" />
          <button className="btn-move" onClick={handleConfirm}>Confirm Move</button>
        </div>
      )}
      {error && <div className="move-error">{error}</div>}

      {sorted.length === 0 ? (
        <div className="empty-state">No inventory yet. Capture and approve photos to get started.</div>
      ) : (
        <div className="cat-grid">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {sorted.map((cat: any) => (
            <CategoryCard
              key={String(cat.id)}
              cat={cat}
              moveMode={moveMode}
              step={step}
              isFrom={cat.category.tag === fromCategory}
              isTo={cat.category.tag === toCategory}
              onPickCategory={handlePickCategory}
              onPickStatus={handlePickStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
