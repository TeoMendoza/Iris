import { useState, useEffect, useRef } from 'react'
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
type StatusFilter = 'All' | 'Shelf' | 'Storage' | 'Sold'

// ── Constants ──────────────────────────────────────────────

const CATEGORIES = ['Clothing', 'Footwear', 'Electronics', 'Furniture', 'Food', 'Books', 'Tools', 'Toys', 'Misc'] as const
const CONDITIONS  = ['New', 'LikeNew', 'Good', 'Fair', 'Poor'] as const
type CategoryTag  = typeof CATEGORIES[number]
type ConditionTag = typeof CONDITIONS[number]

const CATEGORY_COLORS: Record<string, string> = {
  Clothing: '#7c5ce7', Footwear: '#2d7d46', Electronics: '#0ea5e9',
  Furniture: '#d97706', Food: '#ef4444', Books: '#a855f7',
  Tools: '#10b981', Toys: '#f59e0b', Misc: '#94a3b8',
}

const STATUS_COLORS = { Shelf: '#2d7d46', Storage: '#d97706', Sold: '#7c5ce7' }

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

// ── Shared ─────────────────────────────────────────────────

function ItemImage({ bytes }: { bytes: Uint8Array }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!bytes?.length) return
    let mime = 'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png'
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = 'image/gif'
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    setFailed(false)
    return () => URL.revokeObjectURL(url)
  }, [bytes])

  if (failed || !src) return <div className="img-wrap img-placeholder"><span>No image</span></div>
  return <div className="img-wrap"><img src={src} alt="" onError={() => setFailed(true)} /></div>
}

function statusBadgeClass(tag: string) {
  if (tag === 'Shelf') return 'badge badge-shelf'
  if (tag === 'Sold') return 'badge badge-sold'
  return 'badge badge-storage'
}

function conditionLabel(tag: string) { return tag === 'LikeNew' ? 'Like New' : tag }

// ── Charts ─────────────────────────────────────────────────

function DonutChart({ data, size = 140, thickness = 16, center }: {
  data: { value: number; color: string; label: string }[]
  size?: number
  thickness?: number
  center?: string
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
  const [category, setCategory] = useState<string>(item.predictedCategory.tag)
  const [condition, setCondition] = useState<string>(item.predictedCondition.tag)
  const [price, setPrice] = useState<string>(String(item.predictedPrice.toFixed(2)))

  function handleConfirm() {
    getConnection()?.reducers.confirmProcessedImage({
      processedImageId: item.id,
      category: { tag: category as CategoryTag },
      condition: { tag: condition as ConditionTag },
      price: parseFloat(price) || 0,
    })
  }

  return (
    <div className="card" style={{ cursor: 'default' }}>
      <ItemImage bytes={item.imageBytes} />
      <div className="card-body">
        <div className="card-id">#{String(item.id)}</div>
        <div className="prediction">
          <span className="pred-label">Model predicted</span>
          <span className="pred-tag">{item.predictedCategory.tag}</span>
          <span className="pred-tag">{conditionLabel(item.predictedCondition.tag)}</span>
          <span className="pred-price">${item.predictedPrice.toFixed(2)}</span>
        </div>
        <div className="fields">
          <div className="field">
            <span className="field-label">Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Condition</span>
            <select value={condition} onChange={e => setCondition(e.target.value)}>
              {CONDITIONS.map(c => <option key={c} value={c}>{conditionLabel(c)}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Price</span>
            <div className="price-wrap">
              <span className="currency">$</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" />
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleConfirm}>Confirm</button>
      </div>
    </div>
  )
}

function ReviewQueue() {
  const [items] = useTable(tables.inventory_to_review)
  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Review Queue</h2>
        {items.length > 0 && <span className="page-count">{items.length} pending</span>}
      </div>
      {items.length === 0
        ? <div className="empty-state">No items waiting for review.</div>
        : <div className="card-grid">{items.map(item => <ReviewCard key={String(item.id)} item={item} />)}</div>}
    </div>
  )
}

// ── Inventory ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditModal({ item, onClose }: { item: any; onClose: () => void }) {
  const { getConnection } = useSpacetimeDB()
  const [status, setStatus] = useState<string>(item.status.tag)
  const [price, setPrice] = useState<string>(String(item.price.toFixed(2)))

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSave() {
    getConnection()?.reducers.updateInventoryItem({
      itemId: item.id,
      status: { tag: status as 'Sold' | 'Shelf' | 'Storage' },
      price: parseFloat(price) || 0,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Edit Item #{String(item.id)}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <ModalImage bytes={item.imageBytes} />
        <div className="modal-body">
          <div className="fields">
            <div className="field">
              <span className="field-label">Status</span>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Storage">Storage</option>
                <option value="Shelf">Shelf</option>
                <option value="Sold">Sold</option>
              </select>
            </div>
            <div className="field">
              <span className="field-label">Price</span>
              <div className="price-wrap">
                <span className="currency">$</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" autoFocus />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function ModalImage({ bytes }: { bytes: Uint8Array }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!bytes?.length) return
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [bytes])
  if (!src) return null
  return <img src={src} alt="" className="modal-img" />
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InventoryCard({ item }: { item: any }) {
  const [editOpen, setEditOpen] = useState(false)
  return (
    <>
      <div className="card" onClick={() => setEditOpen(true)}>
        <ItemImage bytes={item.imageBytes} />
        <div className="card-body">
          <div className="card-info-row">
            <span className={statusBadgeClass(item.status.tag)}>{item.status.tag}</span>
            <span className="card-price">${item.price.toFixed(2)}</span>
          </div>
          <div className="card-id">#{String(item.id)}</div>
        </div>
      </div>
      {editOpen && <EditModal item={item} onClose={() => setEditOpen(false)} />}
    </>
  )
}

function InventoryPage() {
  const [items] = useTable(tables.inventory)
  const [filter, setFilter] = useState<StatusFilter>('All')
  const filtered = filter === 'All' ? items : items.filter((i: { status: { tag: string } }) => i.status.tag === filter)

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Inventory</h2>
        <span className="page-count">{filtered.length} items</span>
      </div>
      <div className="filter-bar">
        {(['All', 'Shelf', 'Storage', 'Sold'] as StatusFilter[]).map(f => (
          <button key={f} className={`filter-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="empty-state">No {filter === 'All' ? '' : filter.toLowerCase() + ' '}items.</div>
        : <div className="card-grid">{filtered.map((item: { id: bigint | number }) => <InventoryCard key={String(item.id)} item={item} />)}</div>}
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

  useEffect(() => {
    let stream: MediaStream | undefined
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
      .then(s => { stream = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play() } })
      .catch(err => console.error('Camera error:', err))
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [facing])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
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
    getConnection()?.reducers.uploadImage({ imageBytes: photo.bytes })
    URL.revokeObjectURL(photo.url)
    setQueue(q => q.filter(p => p.id !== photo.id))
  }

  function handleDelete(photo: QueuedPhoto) {
    URL.revokeObjectURL(photo.url)
    setQueue(q => q.filter(p => p.id !== photo.id))
  }

  return (
    <div className="page">
      <div className="page-header"><h2 className="page-title">Capture</h2></div>
      <div className="capture-page-inner">
        <div className="capture-zone-wrap">
          <video ref={videoRef} className="capture-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <button className="capture-flip-btn" onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}>
            <Icon d={['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15']} size={18} />
          </button>
        </div>
        <div className="capture-shutter-row">
          <button className="capture-shutter" onClick={handleCapture}>
            <div className="capture-shutter-inner" />
          </button>
        </div>
        {queue.length > 0 && (
          <div>
            <div className="capture-queue-header">
              <span className="capture-queue-label">{queue.length} photo{queue.length !== 1 ? 's' : ''} ready to send</span>
            </div>
            <div className="capture-queue-list">
              {queue.map(photo => (
                <div key={photo.id} className="capture-queue-item">
                  <img src={photo.url} alt="" className="capture-queue-thumb" />
                  <div className="capture-queue-btns">
                    <button className="capture-q-send" onClick={() => handleSend(photo)}>Send</button>
                    <button className="capture-q-delete" onClick={() => handleDelete(photo)}>Del</button>
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
function AnalyticsOverviewTab({ ov }: { ov: any }) {
  if (!ov) return <div className="empty-state">No data yet. Items will appear here once processed.</div>

  const totalItems = ov.shelf.count + ov.storage.count + ov.sold.count

  const statusDonutData = [
    { value: ov.shelf.count,   color: STATUS_COLORS.Shelf,   label: 'Shelf' },
    { value: ov.storage.count, color: STATUS_COLORS.Storage, label: 'Storage' },
    { value: ov.sold.count,    color: STATUS_COLORS.Sold,    label: 'Sold' },
  ]

  const statusDetails = [
    {
      key: 'shelf',
      label: 'Shelf',
      color: STATUS_COLORS.Shelf,
      count: ov.shelf.count,
      value: ov.shelf.value,
      cats: ov.shelf.topCategories,
      desc: 'Items on the shop floor, ready to sell',
    },
    {
      key: 'storage',
      label: 'Storage',
      color: STATUS_COLORS.Storage,
      count: ov.storage.count,
      value: ov.storage.value,
      cats: ov.storage.topCategories,
      desc: 'Catalogued items held in the stockroom',
    },
    {
      key: 'sold',
      label: 'Sold',
      color: STATUS_COLORS.Sold,
      count: ov.sold.count,
      value: ov.sold.value,
      cats: ov.sold.topCategories,
      desc: 'Completed sales — total revenue earned',
    },
  ]

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-title">At a Glance</div>
        <div className="analytics-section-desc">High-level totals across your entire inventory.</div>
        <div className="stat-row">
          <StatCard label="Total Items" value={String(totalItems)} />
          <StatCard label="Shelf Value" value={`$${ov.shelf.value.toFixed(0)}`} sub="available for sale" />
          <StatCard label="Revenue" value={`$${ov.sold.value.toFixed(0)}`} sub="from sold items" />
          <StatCard label="Pending Review" value={String(ov.pendingReview)} sub="awaiting confirmation" />
          <StatCard label="Employees" value={String(ov.totalEmployees)} />
        </div>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-title">Inventory by Status</div>
        <div className="analytics-section-desc">
          How your items are distributed across each status. <strong>Top categories</strong> shows the 3 most common item types in each status — useful for spotting what's selling well vs. what's sitting in storage.
        </div>
        <div className="status-layout">
          <div>
            <DonutChart data={statusDonutData} size={150} thickness={18} center={String(totalItems)} />
            <div className="donut-legend" style={{ marginTop: 14 }}>
              {statusDetails.map(s => (
                <div key={s.key} className="legend-item">
                  <span className="legend-dot" style={{ background: s.color }} />
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-val">{s.count} items</span>
                </div>
              ))}
            </div>
          </div>
          <div className="status-cols">
            {statusDetails.map(s => (
              <div key={s.key} className="status-col">
                <div className="status-col-header">
                  <span className="status-dot" style={{ background: s.color }} />
                  <span className="status-col-name">{s.label}</span>
                </div>
                <div className="status-col-count">{s.count}</div>
                <div className="status-col-value">${s.value.toFixed(2)}</div>
                <div className="status-col-desc">{s.desc}</div>
                {s.cats.length > 0 && (
                  <div className="status-top-cats">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {s.cats.map((cat: any) => <span key={cat.tag} className="status-cat-tag">{cat.tag}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnalyticsCategoriesTab({ bd }: { bd: any }) {
  if (!bd) return <div className="empty-state">No data yet.</div>

  const entries: [string, { count: number; totalValue: number; valuePct: number }][] = [
    ['Clothing', bd.clothing], ['Footwear', bd.footwear], ['Electronics', bd.electronics],
    ['Furniture', bd.furniture], ['Food', bd.food], ['Books', bd.books],
    ['Tools', bd.tools], ['Toys', bd.toys], ['Misc', bd.misc],
  ]

  const active = entries.filter(([, d]) => d.count > 0)
  const maxCount = Math.max(...active.map(([, d]) => d.count), 1)
  const totalValue = active.reduce((s, [, d]) => s + d.totalValue, 0)
  const totalCount = active.reduce((s, [, d]) => s + d.count, 0)

  const donutData = active.slice(0, 6).map(([label, d]) => ({
    value: d.count, color: CATEGORY_COLORS[label] ?? '#94a3b8', label,
  }))

  return (
    <>
      <div className="analytics-section">
        <div className="analytics-section-title">Category Distribution</div>
        <div className="analytics-section-desc">
          How your inventory breaks down by item type. The chart shows the proportion of items in each category. <strong>Value %</strong> tells you what portion of your total inventory value each category represents.
        </div>
        {active.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>No items yet.</div>
        ) : (
          <div className="donut-and-legend" style={{ marginBottom: 28 }}>
            <DonutChart data={donutData} size={160} thickness={20} center={String(totalCount)} />
            <div className="donut-legend">
              {donutData.map(d => (
                <div key={d.label} className="legend-item">
                  <span className="legend-dot" style={{ background: d.color }} />
                  <span className="legend-label">{d.label}</span>
                  <span className="legend-val">{d.value} items</span>
                </div>
              ))}
              {active.length > 6 && <div className="legend-item"><span className="legend-dot" style={{ background: '#94a3b8' }} /><span className="legend-label">Other</span></div>}
            </div>
          </div>
        )}
        <div className="cat-list">
          {active.map(([label, detail]) => (
            <div key={label} className="cat-row">
              <span className="cat-name">{label}</span>
              <div className="cat-track">
                <div className="cat-fill" style={{ width: `${(detail.count / maxCount) * 100}%`, background: CATEGORY_COLORS[label] }} />
              </div>
              <span className="cat-count">{detail.count}</span>
              <span className="cat-value">${detail.totalValue.toFixed(0)}</span>
              <span className="cat-pct">{totalValue > 0 ? detail.valuePct.toFixed(1) : 0}%</span>
            </div>
          ))}
        </div>
        {totalValue > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total inventory value</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>${totalValue.toFixed(2)}</span>
          </div>
        )}
      </div>
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnalyticsModelTab({ acc }: { acc: any }) {
  const noData = !acc || acc.totalClassified === 0

  const catPct = acc?.categoryAccuracyPct ?? 0
  const pricePct = acc?.avgPriceDeltaPct ?? 0

  const catDonut = [
    { value: catPct, color: '#2d7d46', label: 'Correct' },
    { value: Math.max(0, 100 - catPct), color: 'rgba(100,80,160,0.12)', label: 'Incorrect' },
  ]

  return (
    <div className="analytics-section">
      <div className="analytics-section-title">AI Model Performance</div>
      <div className="analytics-section-desc">
        After an employee confirms or corrects an item, we compare that to what the AI originally predicted. These stats show how accurately the model is classifying items — a higher category accuracy means less manual correction needed.
      </div>

      {noData ? (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          No confirmed items yet. Stats will appear once items have been reviewed.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 16 }}>Based on {acc.totalClassified} confirmed item{acc.totalClassified !== 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <DonutChart data={catDonut} size={130} thickness={16} center={`${catPct.toFixed(0)}%`} />
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Category Accuracy</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, maxWidth: 160 }}>
                  The AI correctly identified the category on the first pass {catPct.toFixed(1)}% of the time.
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="stat-card" style={{ marginBottom: 12 }}>
                  <div className="stat-label">Avg Price Delta</div>
                  <div className="stat-value">{pricePct.toFixed(1)}%</div>
                  <div className="stat-sub">
                    On average, the AI's price estimate is off by {pricePct.toFixed(1)}% compared to the employee-confirmed price. Lower is better.
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Items Reviewed</div>
                  <div className="stat-value">{acc.totalClassified}</div>
                  <div className="stat-sub">Total items the model has classified and an employee has confirmed.</div>
                </div>
              </div>
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
      {tab === 'overview'    && <AnalyticsOverviewTab ov={ov} />}
      {tab === 'categories'  && <AnalyticsCategoriesTab bd={bd} />}
      {tab === 'model'       && <AnalyticsModelTab acc={acc} />}
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
    navigator.clipboard.writeText(company.code.toUpperCase())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-header"><h2 className="page-title">Settings</h2></div>
      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-title">Account</div>
          <div className="settings-value">{myUser?.name ?? '—'}</div>
          <div className="settings-meta">{myUser?.email ?? ''}</div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Company</div>
          <div className="settings-value">{company?.name ?? '—'}</div>
          <div className="settings-meta">Share this code to invite team members</div>
          <div className="code-box">
            <span className="code-text">{company?.code ?? '——————'}</span>
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
                  <span className="employee-name">{stat.name}</span>
                  <span className="employee-count">{stat.itemsHandled} items confirmed</span>
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

  const myUser    = myUserRows[0]
  const myEmployee = myEmployeeRows[0]
  const myCompany  = companies[0]

  if (!myUser)     return <SignUp />
  if (!myEmployee) return <JoinCompany />

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} companyName={myCompany?.name ?? ''} userName={myUser.name} />
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
