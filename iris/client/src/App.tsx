import { useState, useEffect, useRef, useMemo } from 'react'
import { SpacetimeDBProvider, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import './App.css'

const savedToken = localStorage.getItem('iris_token') ?? undefined

const connectionBuilder = DbConnection.builder()
  .withUri('https://maincloud.spacetimedb.com')
  .withDatabaseName('iris-logistics')
  .withCompression('none')
  .withToken(savedToken)

// ── Types ──────────────────────────────────────────────────

type Page = 'review' | 'inventory' | 'capture' | 'analytics' | 'settings'
type AnalyticsTab = 'overview' | 'categories' | 'model'
type CategoryTag = 'Clothing' | 'Footwear' | 'Electronics' | 'Furniture' | 'Food' | 'Books' | 'Tools' | 'Toys' | 'Misc'
type StatusTag = 'Shelf' | 'Storage' | 'Sold'

// ── Constants ──────────────────────────────────────────────

const CATEGORIES: CategoryTag[] = ['Clothing', 'Footwear', 'Electronics', 'Furniture', 'Food', 'Books', 'Tools', 'Toys', 'Misc']
const STATUSES: StatusTag[] = ['Shelf', 'Storage', 'Sold']

const CATEGORY_COLORS: Record<string, string> = {
  Clothing: '#7c5ce7', Footwear: '#2d7d46', Electronics: '#0ea5e9',
  Furniture: '#d97706', Food: '#ef4444', Books: '#a855f7',
  Tools: '#10b981', Toys: '#f59e0b', Misc: '#94a3b8',
}

const STATUS_COLORS: Record<StatusTag, string> = { Shelf: '#2d7d46', Storage: '#d97706', Sold: '#7c5ce7' }

// ── Icons ──────────────────────────────────────────────────

function Icon({ d, size = 18 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

const ICONS: Record<Page, string[]> = {
  review:    ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'm9 12 2 2 4-4'],
  inventory: ['M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
  capture:   ['M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z', 'M12 17a4 4 0 100-8 4 4 0 000 8z'],
  analytics: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  settings:  ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'],
}

const PAGE_LABELS: Record<Page, string> = {
  review: 'Review Queue', inventory: 'Inventory', capture: 'Capture', analytics: 'Analytics', settings: 'Settings',
}

// ── Helpers ────────────────────────────────────────────────

function bytesToUrl(bytes: Uint8Array): string | null {
  if (!bytes?.length) return null
  let mime = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png'
  else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = 'image/gif'
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })
  return URL.createObjectURL(blob)
}

function tsToMs(ts: unknown): number {
  if (typeof ts === 'bigint') return Number(ts / 1000n)
  if (ts && typeof ts === 'object' && 'microsSinceEpoch' in ts) return Number((ts as { microsSinceEpoch: bigint }).microsSinceEpoch / 1000n)
  return Number(ts)
}

function formatDate(ts: unknown): string {
  return new Date(tsToMs(ts)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function avgItemValue(cat: { totalValue: number; shelfCount: number; storageCount: number; soldCount: number }): number {
  const total = cat.shelfCount + cat.storageCount + cat.soldCount
  return total > 0 ? cat.totalValue / total : 0
}

// ── Shared components ──────────────────────────────────────

function ItemImage({ bytes, className }: { bytes: Uint8Array; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const url = bytesToUrl(bytes)
    if (!url) return
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [bytes])

  if (!src) return <div className={`img-placeholder ${className ?? ''}`}><span>No image</span></div>
  return <img src={src} alt="" className={className} />
}

// ── Layout ─────────────────────────────────────────────────

function Sidebar({ page, setPage, companyName, userName }: { page: Page; setPage: (p: Page) => void; companyName: string; userName: string }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-name">ir<em>i</em>s</div>
        {companyName && <div className="sidebar-company">{companyName}</div>}
      </div>
      <nav className="sidebar-nav">
        {(Object.keys(PAGE_LABELS) as Page[]).map(p => (
          <button key={p} className={`sidebar-link${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>
            <Icon d={ICONS[p]} size={16} />
            {PAGE_LABELS[p]}
          </button>
        ))}
      </nav>
      {userName && <div className="sidebar-footer"><div className="sidebar-user">{userName}</div></div>}
    </aside>
  )
}

function BottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav className="bottom-nav">
      {(Object.keys(PAGE_LABELS) as Page[]).map(p => (
        <button key={p} className={`bottom-nav-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>
          <Icon d={ICONS[p]} size={20} />
          {PAGE_LABELS[p].split(' ')[0]}
        </button>
      ))}
    </nav>
  )
}

// ── Global subscriptions ───────────────────────────────────

function GlobalSubscriptions() {
  useTable(tables.review_queue)
  useTable(tables.inventory_categories)
  useTable(tables.stock_entries)
  useTable(tables.analytics_overview)
  useTable(tables.category_breakdown)
  useTable(tables.model_accuracy)
  useTable(tables.employee_stats)
  return null
}

// ── Auth ───────────────────────────────────────────────────

function SignUp() {
  const { getConnection } = useSpacetimeDB()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">ir<em>i</em>s</div>
        <p className="auth-sub">Create your account to get started</p>
        <input className="auth-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
        <input className="auth-input" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && getConnection()?.reducers.createUser({ name: name.trim(), email: email.trim() })} placeholder="Email address" type="email" />
        <button className="auth-btn" onClick={() => { if (name.trim() && email.trim()) getConnection()?.reducers.createUser({ name: name.trim(), email: email.trim() }) }}>Create Account</button>
      </div>
    </div>
  )
}

function JoinCompany() {
  const { getConnection } = useSpacetimeDB()
  const [code, setCode] = useState('')

  function handleJoin() {
    if (!code.trim()) return
    getConnection()?.reducers.joinCompany({ code: code.trim().toLowerCase() })
    setCode('')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">ir<em>i</em>s</div>
        <p className="auth-sub">Enter your company invite code to continue</p>
        <input className="auth-input" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="Invite code" autoFocus />
        <button className="auth-btn" onClick={handleJoin}>Join Company</button>
      </div>
    </div>
  )
}

// ── Review Queue ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewCard({ item }: { item: any }) {
  const { getConnection } = useSpacetimeDB()
  const [category, setCategory] = useState<CategoryTag>(item.predictedCategory.tag)
  const [count, setCount] = useState<string>(String(item.predictedCount))
  const [totalValue, setTotalValue] = useState<string>(String(item.predictedTotalValue.toFixed(2)))
  const [useAsPhoto, setUseAsPhoto] = useState(false)

  function handleApprove() {
    getConnection()?.reducers.approveReviewItem({
      reviewItemId: item.id,
      category: { tag: category },
      count: parseInt(count) || 0,
      totalValue: parseFloat(totalValue) || 0,
      useAsCategoryPhoto: useAsPhoto,
    })
  }

  function handleReject() {
    getConnection()?.reducers.rejectReviewItem({ reviewItemId: item.id })
  }

  const avg = (parseFloat(totalValue) || 0) / Math.max(parseInt(count) || 1, 1)

  return (
    <div className="review-card">
      <div className="review-card-prediction">
        <span className="pred-label">AI detected</span>
        <span className="pred-tag" style={{ background: `${CATEGORY_COLORS[item.predictedCategory.tag]}20`, color: CATEGORY_COLORS[item.predictedCategory.tag], borderColor: `${CATEGORY_COLORS[item.predictedCategory.tag]}40` }}>{item.predictedCategory.tag}</span>
        <span className="pred-tag">{item.predictedCount}x</span>
        <span className="pred-price">${item.predictedTotalValue.toFixed(2)}</span>
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
              <input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} min="0" step="0.01" />
            </div>
          </div>
        </div>
        {parseFloat(totalValue) > 0 && parseInt(count) > 1 && (
          <div className="review-avg">${avg.toFixed(2)} avg per item</div>
        )}
        <label className="review-photo-toggle">
          <input type="checkbox" checked={useAsPhoto} onChange={e => setUseAsPhoto(e.target.checked)} />
          <span>Use as category photo</span>
        </label>
      </div>

      <div className="review-card-actions">
        <button className="btn btn-reject" onClick={handleReject}>Reject</button>
        <button className="btn btn-approve" onClick={handleApprove}>Approve</button>
      </div>
    </div>
  )
}

function ReviewQueue() {
  const [items] = useTable(tables.review_queue)

  const groups = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any[]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of items as any[]) {
      const key = String(item.scanId)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return [...map.values()]
  }, [items])

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Review Queue</h2>
        {items.length > 0 && <span className="page-count">{items.length} pending</span>}
      </div>
      {groups.length === 0 ? (
        <div className="empty-state">No items waiting for review.</div>
      ) : (
        <div className="review-groups">
          {groups.map((group, gi) => (
            <div key={gi} className="review-group">
              <div className="review-group-photo">
                <ItemImage bytes={group[0].imageBytes} className="review-group-img" />
              </div>
              <div className="review-group-cards">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {group.map((item: any) => <ReviewCard key={String(item.id)} item={item} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inventory ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryDetailModal({ cat, entries, onClose }: { cat: any; entries: any[]; onClose: () => void }) {
  const { getConnection } = useSpacetimeDB()
  const [fromStatus, setFromStatus] = useState<StatusTag>('Storage')
  const [toStatus, setToStatus] = useState<StatusTag>('Shelf')
  const [moveCount, setMoveCount] = useState('1')
  const [moveError, setMoveError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const avg = avgItemValue(cat)
  const totalCount = cat.shelfCount + cat.storageCount + cat.soldCount
  const activeValue = avg * (cat.shelfCount + cat.storageCount)
  const soldValue = avg * cat.soldCount
  const sellThrough = totalCount > 0 ? (cat.soldCount / totalCount * 100) : 0

  function handleMove() {
    const n = parseInt(moveCount) || 0
    if (n <= 0) { setMoveError('Enter a valid count'); return }
    if (fromStatus === toStatus) { setMoveError('Choose different statuses'); return }
    setMoveError('')
    getConnection()?.reducers.moveStock({
      category: { tag: cat.category.tag },
      fromStatus: { tag: fromStatus },
      toStatus: { tag: toStatus },
      count: n,
    })
    setMoveCount('1')
  }

  const catEntries = entries.filter((e: { category: { tag: string } }) => e.category.tag === cat.category.tag)
    .sort((a: { scannedAt: unknown }, b: { scannedAt: unknown }) => tsToMs(b.scannedAt) - tsToMs(a.scannedAt))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="cat-color-dot" style={{ background: CATEGORY_COLORS[cat.category.tag] }} />
            <span className="modal-title">{cat.category.tag}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {cat.categoryImageBytes?.length > 0 && (
          <ItemImage bytes={cat.categoryImageBytes} className="modal-img" />
        )}

        <div className="modal-body">
          <div className="cat-detail-stats">
            <div className="cat-stat">
              <div className="cat-stat-label">Total Items</div>
              <div className="cat-stat-value">{totalCount}</div>
            </div>
            <div className="cat-stat">
              <div className="cat-stat-label">Avg Value</div>
              <div className="cat-stat-value">${avg.toFixed(2)}</div>
            </div>
            <div className="cat-stat">
              <div className="cat-stat-label">Active Value</div>
              <div className="cat-stat-value">${activeValue.toFixed(0)}</div>
            </div>
            <div className="cat-stat">
              <div className="cat-stat-label">Sold</div>
              <div className="cat-stat-value">${soldValue.toFixed(0)}</div>
            </div>
            <div className="cat-stat">
              <div className="cat-stat-label">Sell-through</div>
              <div className="cat-stat-value">{sellThrough.toFixed(0)}%</div>
            </div>
          </div>

          <div className="move-section">
            <div className="move-section-title">Move Stock</div>
            <div className="move-row">
              <input
                type="number"
                className="move-count-input"
                value={moveCount}
                onChange={e => setMoveCount(e.target.value)}
                min="1"
                placeholder="Qty"
              />
              <select className="move-select" value={fromStatus} onChange={e => setFromStatus(e.target.value as StatusTag)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="move-arrow">→</span>
              <select className="move-select" value={toStatus} onChange={e => setToStatus(e.target.value as StatusTag)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-move" onClick={handleMove}>Move</button>
            </div>
            {moveError && <div className="move-error">{moveError}</div>}
          </div>

          {catEntries.length > 0 && (
            <div className="scan-history">
              <div className="scan-history-title">Scan History</div>
              <table className="scan-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Items Added</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {catEntries.map((e: { id: unknown; scannedAt: unknown; itemsAdded: number; valueAtScan: number }) => (
                    <tr key={String(e.id)}>
                      <td>{formatDate(e.scannedAt)}</td>
                      <td>{e.itemsAdded}</td>
                      <td>${e.valueAtScan.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryCard({ cat, entries }: { cat: any; entries: any[] }) {
  const [open, setOpen] = useState(false)
  const color = CATEGORY_COLORS[cat.category.tag] ?? '#94a3b8'

  return (
    <>
      <div className="cat-card" onClick={() => setOpen(true)}>
        <div className="cat-card-img-wrap">
          {cat.categoryImageBytes?.length > 0 ? (
            <ItemImage bytes={cat.categoryImageBytes} className="cat-card-img" />
          ) : (
            <div className="cat-card-img-placeholder" style={{ background: `${color}18` }}>
              <div className="cat-card-letter" style={{ color }}>{cat.category.tag[0]}</div>
            </div>
          )}
        </div>
        <div className="cat-card-body">
          <div className="cat-card-name">{cat.category.tag}</div>
          <div className="cat-card-counts">
            <span className="cat-count-chip cat-count-shelf">{cat.shelfCount} Shelf</span>
            <span className="cat-count-chip cat-count-storage">{cat.storageCount} Storage</span>
            <span className="cat-count-chip cat-count-sold">{cat.soldCount} Sold</span>
          </div>
        </div>
      </div>
      {open && <CategoryDetailModal cat={cat} entries={entries} onClose={() => setOpen(false)} />}
    </>
  )
}

function InventoryPage() {
  const [cats] = useTable(tables.inventory_categories)
  const [entries] = useTable(tables.stock_entries)

  const sorted = [...cats].sort((a, b) => {
    const ta = (a as { shelfCount: number; storageCount: number; soldCount: number }).shelfCount + (a as { shelfCount: number; storageCount: number; soldCount: number }).storageCount
    const tb = (b as { shelfCount: number; storageCount: number; soldCount: number }).shelfCount + (b as { shelfCount: number; storageCount: number; soldCount: number }).storageCount
    return tb - ta
  })

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Inventory</h2>
        <span className="page-count">{cats.length} categories</span>
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state">No inventory yet. Capture and approve photos to get started.</div>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <div className="cat-grid">{sorted.map((cat: any) => <CategoryCard key={String(cat.id)} cat={cat} entries={entries as any[]} />)}</div>
      )}
    </div>
  )
}

// ── Capture ────────────────────────────────────────────────

type QueuedPhoto = { id: number; url: string; bytes: Uint8Array }

function CapturePage() {
  const { getConnection } = useSpacetimeDB()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [queue, setQueue] = useState<QueuedPhoto[]>([])
  const [nextId, setNextId] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    setCameraReady(false)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then(s => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
          videoRef.current.onloadedmetadata = () => setCameraReady(true)
        }
      })
      .catch(err => console.error('Camera error:', err))
    return () => { stream?.getTracks().forEach(t => t.stop()); setCameraReady(false) }
  }, [facing])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      blob.arrayBuffer().then(buf => {
        const id = nextId
        setQueue(q => [...q, { id, url, bytes: new Uint8Array(buf) }])
        setNextId(n => n + 1)
      })
    }, 'image/jpeg', 0.85)
  }

  function handleSend(photo: QueuedPhoto) {
    getConnection()?.reducers.uploadPhoto({ imageBytes: photo.bytes })
    URL.revokeObjectURL(photo.url)
    setQueue(q => q.filter(p => p.id !== photo.id))
  }

  function handleSendAll() {
    queue.forEach(photo => {
      getConnection()?.reducers.uploadPhoto({ imageBytes: photo.bytes })
      URL.revokeObjectURL(photo.url)
    })
    setQueue([])
  }

  function handleDelete(photo: QueuedPhoto) {
    URL.revokeObjectURL(photo.url)
    setQueue(q => q.filter(p => p.id !== photo.id))
  }

  return (
    <div className="page capture-page">
      <div className="page-header"><h2 className="page-title">Capture</h2></div>
      <div className="capture-inner">
        <div className="capture-camera-wrap">
          <video ref={videoRef} className="capture-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <button className="capture-flip-btn" onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}>
            <Icon d={['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15']} size={18} />
          </button>
          {!cameraReady && <div className="capture-loading">Initializing camera…</div>}
        </div>

        <div className="capture-hint">
          AI will identify each item category in the photo automatically
        </div>

        <div className="capture-shutter-row">
          <div className="capture-shutter-spacer" />
          <button className="capture-shutter" onClick={handleCapture} disabled={!cameraReady}>
            <div className="capture-shutter-inner" />
          </button>
          <div className="capture-shutter-spacer" />
        </div>

        {queue.length > 0 && (
          <div className="capture-queue">
            <div className="capture-queue-bar">
              <span className="capture-queue-label">{queue.length} photo{queue.length !== 1 ? 's' : ''} ready</span>
              {queue.length > 1 && (
                <button className="capture-send-all" onClick={handleSendAll}>Send all</button>
              )}
            </div>
            <div className="capture-queue-grid">
              {queue.map(photo => (
                <div key={photo.id} className="capture-queue-item">
                  <img src={photo.url} alt="" className="capture-queue-thumb" />
                  <div className="capture-queue-actions">
                    <button className="capture-q-send" onClick={() => handleSend(photo)}>Send</button>
                    <button className="capture-q-delete" onClick={() => handleDelete(photo)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Charts ─────────────────────────────────────────────────

function DonutChart({ data, size = 140, thickness = 16, center }: {
  data: { value: number; color: string; label: string }[]
  size?: number; thickness?: number; center?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = size / 2
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  let acc = 0

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(100,80,160,0.1)" strokeWidth={thickness} />
        {total > 0 && data.filter(d => d.value > 0).map((d, i) => {
          const arc = (d.value / total) * circumference
          const startAngle = (acc / circumference) * 360 - 90
          const el = (
            <circle key={i} cx={cx} cy={cx} r={r} fill="none"
              stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${arc} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(${startAngle} ${cx} ${cx})`}
            />
          )
          acc += arc
          return el
        })}
      </svg>
      {center && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: Math.round(size * 0.16), fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1 }}>{center}</div>
        </div>
      )}
    </div>
  )
}

function LineChart({ points }: { points: { x: number; y: number; label: string }[] }) {
  if (points.length === 0) return <div className="line-chart-empty">No scan data yet</div>
  if (points.length === 1) {
    return (
      <div className="line-chart-single">
        <div className="line-chart-single-dot" />
        <div className="line-chart-single-label">{points[0].label} — {points[0].y} items</div>
      </div>
    )
  }

  const W = 400, H = 100, PL = 8, PR = 8, PT = 10, PB = 10
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = 0, yMax = Math.max(...ys, 1)
  const px = (x: number) => PL + ((x - xMin) / (xMax - xMin || 1)) * (W - PL - PR)
  const py = (y: number) => PT + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PT - PB)

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x)},${py(p.y)}`).join(' ')
  const fill = `${d} L${px(xs[xs.length - 1])},${H} L${px(xs[0])},${H} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="line-chart">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lavender)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--lavender)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#lineGrad)" />
      <path d={d} fill="none" stroke="var(--lavender)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" fill="var(--lavender)" />)}
    </svg>
  )
}

// ── Analytics ──────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnalyticsOverviewTab({ ov, cats }: { ov: any; cats: any[] }) {
  if (!ov) return <div className="empty-state">No data yet. Items will appear once processed.</div>

  const totalItems = ov.shelfCount + ov.storageCount + ov.soldCount
  const totalActive = ov.shelfValue + ov.storageValue

  const statusDonut = [
    { value: ov.shelfCount,   color: STATUS_COLORS.Shelf,   label: 'Shelf' },
    { value: ov.storageCount, color: STATUS_COLORS.Storage, label: 'Storage' },
    { value: ov.soldCount,    color: STATUS_COLORS.Sold,    label: 'Sold' },
  ]

  const sortedCats = [...cats]
    .map((c: { category: { tag: string }; shelfCount: number; storageCount: number; soldCount: number; totalValue: number }) => {
      const total = c.shelfCount + c.storageCount + c.soldCount
      const avg = total > 0 ? c.totalValue / total : 0
      const active = avg * (c.shelfCount + c.storageCount)
      return { tag: c.category.tag, active }
    })
    .filter(c => c.active > 0)
    .sort((a, b) => b.active - a.active)

  const maxActive = Math.max(...sortedCats.map(c => c.active), 1)

  function handleCsvDownload() {
    const headers = ['Category', 'Shelf', 'Storage', 'Sold', 'Avg Item Value', 'Active Value', 'Sold Value', 'Total Ever']
    const rows = cats.map((c: { category: { tag: string }; shelfCount: number; storageCount: number; soldCount: number; totalValue: number }) => {
      const total = c.shelfCount + c.storageCount + c.soldCount
      const avg = total > 0 ? c.totalValue / total : 0
      return [
        c.category.tag,
        c.shelfCount,
        c.storageCount,
        c.soldCount,
        avg.toFixed(2),
        (avg * (c.shelfCount + c.storageCount)).toFixed(2),
        (avg * c.soldCount).toFixed(2),
        total,
      ]
    })

    const totalRow = ['TOTAL',
      cats.reduce((s: number, c: { shelfCount: number }) => s + c.shelfCount, 0),
      cats.reduce((s: number, c: { storageCount: number }) => s + c.storageCount, 0),
      cats.reduce((s: number, c: { soldCount: number }) => s + c.soldCount, 0),
      '', ov.shelfValue.toFixed(2) + ' + ' + ov.storageValue.toFixed(2),
      ov.soldValue.toFixed(2), totalItems]

    const csv = [
      `Iris Inventory Report — ${new Date().toLocaleDateString()}`,
      '',
      headers.join(','),
      ...rows.map((r: (string | number)[]) => r.join(',')),
      totalRow.join(','),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iris-inventory-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-header">
          <div>
            <div className="analytics-section-title">At a Glance</div>
            <div className="analytics-section-desc">High-level totals across all inventory.</div>
          </div>
          <button className="csv-btn" onClick={handleCsvDownload}>
            <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} />
            Export CSV
          </button>
        </div>
        <div className="stat-row">
          <StatCard label="Total Items" value={String(totalItems)} />
          <StatCard label="Active Value" value={`$${totalActive.toFixed(0)}`} sub="shelf + storage" />
          <StatCard label="Revenue" value={`$${ov.soldValue.toFixed(0)}`} sub="from sold items" />
          <StatCard label="Categories" value={String(ov.activeCategories)} />
          <StatCard label="Pending Review" value={String(ov.pendingReview)} />
          <StatCard label="Employees" value={String(ov.totalEmployees)} />
        </div>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-title">Inventory by Status</div>
        <div className="analytics-section-desc">Distribution of items across each status.</div>
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
                <div className="status-col-value">${s.value.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sortedCats.length > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Value by Category</div>
          <div className="analytics-section-desc">Active inventory value (shelf + storage) per category.</div>
          <div className="cat-list">
            {sortedCats.map(c => (
              <div key={c.tag} className="cat-row">
                <span className="cat-name">{c.tag}</span>
                <div className="cat-track">
                  <div className="cat-fill" style={{ width: `${(c.active / maxActive) * 100}%`, background: CATEGORY_COLORS[c.tag] }} />
                </div>
                <span className="cat-value">${c.active.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryAnalyticsDetail({ cat, entries, onBack }: { cat: any; entries: any[]; onBack: () => void }) {
  const catEntries = entries
    .filter((e: { category: { tag: string } }) => e.category.tag === cat.tag)
    .sort((a: { scannedAt: unknown }, b: { scannedAt: unknown }) => tsToMs(a.scannedAt) - tsToMs(b.scannedAt))

  const totalCount = cat.shelfCount + cat.storageCount + cat.soldCount
  const avg = totalCount > 0 ? cat.totalValue / totalCount : 0
  const activeValue = avg * (cat.shelfCount + cat.storageCount)
  const soldValue = avg * cat.soldCount
  const sellThrough = totalCount > 0 ? (cat.soldCount / totalCount * 100) : 0

  const linePoints = catEntries.map((e: { scannedAt: unknown; itemsAdded: number }, i: number) => ({
    x: i,
    y: e.itemsAdded,
    label: formatDate(e.scannedAt),
  }))

  const donutData = [
    { value: cat.shelfCount,   color: STATUS_COLORS.Shelf,   label: 'Shelf' },
    { value: cat.storageCount, color: STATUS_COLORS.Storage, label: 'Storage' },
    { value: cat.soldCount,    color: STATUS_COLORS.Sold,    label: 'Sold' },
  ]

  return (
    <>
      <button className="back-btn" onClick={onBack}>
        <Icon d="M19 12H5M12 19l-7-7 7-7" size={15} /> Back to categories
      </button>

      <div className="analytics-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="cat-color-dot" style={{ background: CATEGORY_COLORS[cat.tag] ?? '#94a3b8' }} />
          <div className="analytics-section-title" style={{ marginBottom: 0 }}>{cat.tag}</div>
        </div>
        <div className="stat-row">
          <StatCard label="On Shelf" value={String(cat.shelfCount)} />
          <StatCard label="In Storage" value={String(cat.storageCount)} />
          <StatCard label="Sold" value={String(cat.soldCount)} />
          <StatCard label="Avg Item Value" value={`$${avg.toFixed(2)}`} />
          <StatCard label="Active Value" value={`$${activeValue.toFixed(0)}`} />
          <StatCard label="Revenue" value={`$${soldValue.toFixed(0)}`} />
          <StatCard label="Sell-through" value={`${sellThrough.toFixed(0)}%`} />
        </div>
      </div>

      {totalCount > 0 && (
        <div className="analytics-section">
          <div className="analytics-section-title">Status Distribution</div>
          <div className="donut-and-legend">
            <DonutChart data={donutData} size={140} thickness={18} center={String(totalCount)} />
            <div className="donut-legend">
              {donutData.map(d => (
                <div key={d.label} className="legend-item">
                  <span className="legend-dot" style={{ background: d.color }} />
                  <span className="legend-label">{d.label}</span>
                  <span className="legend-val">{d.value} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {catEntries.length > 0 && (
        <>
          <div className="analytics-section">
            <div className="analytics-section-title">Items Added Per Scan</div>
            <div style={{ marginTop: 16 }}>
              <LineChart points={linePoints} />
            </div>
          </div>

          <div className="analytics-section">
            <div className="analytics-section-title">Scan History</div>
            <table className="scan-table">
              <thead>
                <tr><th>Date</th><th>Items Added</th><th>Value</th></tr>
              </thead>
              <tbody>
                {[...catEntries].reverse().map((e: { id: unknown; scannedAt: unknown; itemsAdded: number; valueAtScan: number }) => (
                  <tr key={String(e.id)}>
                    <td>{formatDate(e.scannedAt)}</td>
                    <td>{e.itemsAdded}</td>
                    <td>${e.valueAtScan.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnalyticsCategoriesTab({ bd, cats, entries }: { bd: any; cats: any[]; entries: any[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  if (!bd) return <div className="empty-state">No data yet.</div>

  const selectedCat = selected ? cats.find((c: { category: { tag: string } }) => c.category.tag === selected) : null

  if (selectedCat) {
    return <CategoryAnalyticsDetail cat={{ ...selectedCat, tag: selectedCat.category.tag }} entries={entries} onBack={() => setSelected(null)} />
  }

  const active = cats
    .filter((c: { shelfCount: number; storageCount: number; soldCount: number }) => c.shelfCount + c.storageCount + c.soldCount > 0)
    .sort((a: { totalValue: number }, b: { totalValue: number }) => b.totalValue - a.totalValue)

  if (active.length === 0) return <div className="empty-state">No inventory yet.</div>

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">Category Overview</div>
      <div className="analytics-section-desc">Click a category to see detailed analytics.</div>
      <div className="cat-analytics-grid">
        {active.map((c: { id: unknown; category: { tag: string }; shelfCount: number; storageCount: number; soldCount: number; totalValue: number; categoryImageBytes: Uint8Array }) => {
          const total = c.shelfCount + c.storageCount + c.soldCount
          const avg = total > 0 ? c.totalValue / total : 0
          const sellThrough = total > 0 ? Math.round(c.soldCount / total * 100) : 0
          const color = CATEGORY_COLORS[c.category.tag] ?? '#94a3b8'
          return (
            <button key={String(c.id)} className="cat-analytics-card" onClick={() => setSelected(c.category.tag)}>
              <div className="cat-analytics-header" style={{ borderTopColor: color }}>
                <div className="cat-analytics-name">{c.category.tag}</div>
                <div className="cat-analytics-total">{total} items</div>
              </div>
              <div className="cat-analytics-body">
                <div className="cat-analytics-stat">
                  <span className="cat-analytics-label">Avg value</span>
                  <span className="cat-analytics-val">${avg.toFixed(2)}</span>
                </div>
                <div className="cat-analytics-stat">
                  <span className="cat-analytics-label">Sell-through</span>
                  <span className="cat-analytics-val">{sellThrough}%</span>
                </div>
                <div className="cat-analytics-counts">
                  <span style={{ color: STATUS_COLORS.Shelf }}>{c.shelfCount}S</span>
                  <span style={{ color: STATUS_COLORS.Storage }}>{c.storageCount}St</span>
                  <span style={{ color: STATUS_COLORS.Sold }}>{c.soldCount}So</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnalyticsModelTab({ acc }: { acc: any }) {
  const noData = !acc || acc.totalProcessed === 0

  const catPct = acc?.categoryAccuracyPct ?? 0
  const rejPct = acc?.rejectionRatePct ?? 0
  const countDelta = acc?.avgCountDeltaPct ?? 0
  const valueDelta = acc?.avgValueDeltaPct ?? 0

  const catDonut = [
    { value: catPct, color: '#2d7d46', label: 'Correct' },
    { value: Math.max(0, 100 - catPct), color: 'rgba(100,80,160,0.12)', label: 'Incorrect' },
  ]

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">AI Model Performance</div>
      <div className="analytics-section-desc">
        Compares what the AI predicted to what employees confirmed after review.
      </div>

      {noData ? (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          No confirmed items yet. Stats appear once items are reviewed.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 20 }}>
            Based on {acc.totalProcessed} scan{acc.totalProcessed !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              <DonutChart data={catDonut} size={130} thickness={16} center={`${catPct.toFixed(0)}%`} />
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Category Accuracy</div>
            </div>
            <div className="stat-row" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Rejection Rate" value={`${rejPct.toFixed(1)}%`} sub="scans rejected by employees" />
              <StatCard label="Avg Count Error" value={`${countDelta.toFixed(1)}%`} sub="how far off item counts were" />
              <StatCard label="Avg Value Error" value={`${valueDelta.toFixed(1)}%`} sub="how far off value estimates were" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('overview')
  const [overviewRows] = useTable(tables.analytics_overview)
  const [breakdownRows] = useTable(tables.category_breakdown)
  const [accuracyRows] = useTable(tables.model_accuracy)
  const [cats] = useTable(tables.inventory_categories)
  const [entries] = useTable(tables.stock_entries)

  const ov = overviewRows[0]
  const bd = breakdownRows[0]
  const acc = accuracyRows[0]

  return (
    <div className="page">
      <div className="page-header"><h2 className="page-title">Analytics</h2></div>
      <div className="analytics-tab-bar">
        {(['overview', 'categories', 'model'] as AnalyticsTab[]).map(t => (
          <button key={t} className={`analytics-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'categories' ? 'Categories' : 'Model'}
          </button>
        ))}
      </div>
      {tab === 'overview'   && <AnalyticsOverviewTab ov={ov} cats={cats as never[]} />}
      {tab === 'categories' && <AnalyticsCategoriesTab bd={bd} cats={cats as never[]} entries={entries as never[]} />}
      {tab === 'model'      && <AnalyticsModelTab acc={acc} />}
    </div>
  )
}

// ── Settings ───────────────────────────────────────────────

function SettingsPage() {
  const [companies] = useTable(tables.company)
  const [myUserRows] = useTable(tables.my_user)
  const [employeeStats] = useTable(tables.employee_stats)
  const [copied, setCopied] = useState(false)

  const company = companies[0]
  const myUser = myUserRows[0]

  function handleCopy() {
    if (!company) return
    navigator.clipboard.writeText((company as { code: string }).code.toUpperCase())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-header"><h2 className="page-title">Settings</h2></div>
      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-title">Account</div>
          <div className="settings-value">{(myUser as { name?: string })?.name ?? '—'}</div>
          <div className="settings-meta">{(myUser as { email?: string })?.email ?? ''}</div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Company</div>
          <div className="settings-value">{(company as { name?: string })?.name ?? '—'}</div>
          <div className="settings-meta">Share this code to invite team members</div>
          <div className="code-box">
            <span className="code-text">{(company as { code?: string })?.code ?? '——————'}</span>
            <button className="copy-btn" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Team — {employeeStats.length} {employeeStats.length === 1 ? 'member' : 'members'}</div>
          <div className="employee-list">
            {employeeStats.length === 0
              ? <div className="settings-meta" style={{ padding: '8px 0' }}>No employees yet.</div>
              : employeeStats.map((stat, i) => (
                <div key={i} className="employee-row">
                  <span className="employee-name">{(stat as { name: string }).name}</span>
                  <span className="employee-count">{(stat as { itemsHandled: number }).itemsHandled} scans confirmed</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────

function Main() {
  const { isActive, token } = useSpacetimeDB()
  useEffect(() => { if (token) localStorage.setItem('iris_token', token) }, [token])

  const [myUserRows]     = useTable(tables.my_user)
  const [myEmployeeRows] = useTable(tables.my_employee)
  const [companies]      = useTable(tables.company)
  const [page, setPage]  = useState<Page>('review')

  if (!isActive) return <div className="connecting">Connecting…</div>

  const myUser     = myUserRows[0]
  const myEmployee = myEmployeeRows[0]
  const myCompany  = companies[0]

  if (!myUser)     return <SignUp />
  if (!myEmployee) return <JoinCompany />

  return (
    <div className="app-shell">
      <GlobalSubscriptions />
      <Sidebar page={page} setPage={setPage} companyName={(myCompany as { name?: string })?.name ?? ''} userName={(myUser as { name?: string })?.name ?? ''} />
      <main className="content">
        {page === 'review'     && <ReviewQueue />}
        {page === 'inventory'  && <InventoryPage />}
        {page === 'capture'    && <CapturePage />}
        {page === 'analytics'  && <AnalyticsPage />}
        {page === 'settings'   && <SettingsPage />}
      </main>
      <BottomNav page={page} setPage={setPage} />
    </div>
  )
}

export default function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <Main />
    </SpacetimeDBProvider>
  )
}
