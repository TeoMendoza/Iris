import { useState, useEffect } from 'react'
import { SpacetimeDBProvider, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import './App.css'

const connectionBuilder = DbConnection.builder()
  .withUri('ws://localhost:3000')
  .withDatabaseName('iris')

// ── Image ─────────────────────────────────────────────────

function ItemImage({ bytes }: { bytes: Uint8Array }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!bytes?.length) return
    let mime = 'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png'
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = 'image/gif'
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    setFailed(false)
    return () => URL.revokeObjectURL(url)
  }, [bytes])

  if (failed || !src) {
    return <div className="img-wrap img-placeholder"><span>No image</span></div>
  }

  return (
    <div className="img-wrap">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </div>
  )
}

// ── Join ──────────────────────────────────────────────────

function JoinCompany() {
  const { getConnection } = useSpacetimeDB()
  const [code, setCode] = useState('')

  function handleJoin() {
    if (!code.trim()) return
    getConnection()?.reducers.joinCompany({ code: code.trim().toLowerCase() })
    setCode('')
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-logo">ir<em>i</em>s</div>
        <p className="join-sub">Enter your company invite code to continue</p>
        <input
          className="join-input"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="Invite code"
          autoFocus
        />
        <button className="join-btn" onClick={handleJoin}>Join Company</button>
      </div>
    </div>
  )
}

// ── Review queue ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewCard({ item }: { item: any }) {
  const { getConnection } = useSpacetimeDB()
  const [category, setCategory] = useState<string>(item.predictedCategory.tag)
  const [color, setColor] = useState<string>(item.predictedColor.tag)
  const [demographic, setDemographic] = useState<string>(item.predictedDemographic.tag)

  function handleConfirm() {
    getConnection()?.reducers.confirmProcessedImage({
      processedImageId: item.id,
      category: { tag: category as 'Shirts' | 'Pants' },
      color: { tag: color as 'Red' | 'Blue' },
      demographic: { tag: demographic as 'Mens' | 'Womens' },
    })
  }

  return (
    <div className="card">
      <ItemImage bytes={item.imageBytes} />
      <div className="card-body">
        <div className="card-id">#{String(item.id)}</div>

        <div className="prediction">
          <span className="pred-label">Model predicted</span>
          <span className="pred-tag">{item.predictedCategory.tag}</span>
          <span className="pred-tag">{item.predictedColor.tag}</span>
          <span className="pred-tag">{item.predictedDemographic.tag}</span>
        </div>

        <div className="fields">
          <div className="field">
            <span className="field-label">Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="Shirts">Shirts</option>
              <option value="Pants">Pants</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">Color</span>
            <select value={color} onChange={e => setColor(e.target.value)}>
              <option value="Red">Red</option>
              <option value="Blue">Blue</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">Demographic</span>
            <select value={demographic} onChange={e => setDemographic(e.target.value)}>
              <option value="Mens">Mens</option>
              <option value="Womens">Womens</option>
            </select>
          </div>
        </div>

        <button className="btn btn-confirm" onClick={handleConfirm}>Confirm</button>
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
        : <div className="card-grid">{items.map(item => <ReviewCard key={String(item.id)} item={item} />)}</div>
      }
    </div>
  )
}

// ── Inventory ─────────────────────────────────────────────

function statusBadgeClass(tag: string) {
  if (tag === 'Shelf') return 'badge badge-shelf'
  if (tag === 'Sold') return 'badge badge-sold'
  return 'badge badge-storage'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InventoryCard({ item }: { item: any }) {
  const { getConnection } = useSpacetimeDB()
  const [status, setStatus] = useState<string>(item.status.tag)
  const [price, setPrice] = useState<string>(String(item.price))

  function handleUpdate() {
    getConnection()?.reducers.updateInventoryItem({
      itemId: item.id,
      status: { tag: status as 'Sold' | 'Shelf' | 'Storage' },
      price: parseFloat(price) || 0,
    })
  }

  return (
    <div className="card">
      <ItemImage bytes={item.imageBytes} />
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-id">#{String(item.id)}</span>
          <span className={statusBadgeClass(status)}>{status}</span>
        </div>

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
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" />
            </div>
          </div>
        </div>

        <button className="btn btn-update" onClick={handleUpdate}>Update</button>
      </div>
    </div>
  )
}

function InventoryPage() {
  const [items] = useTable(tables.inventory)

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Inventory</h2>
        {items.length > 0 && <span className="page-count">{items.length} items</span>}
      </div>
      {items.length === 0
        ? <div className="empty-state">No inventory items yet.</div>
        : <div className="card-grid">{items.map(item => <InventoryCard key={String(item.id)} item={item} />)}</div>
      }
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────

function Main() {
  const { isActive, identity } = useSpacetimeDB()
  const [employees] = useTable(tables.employee)
  const [companies] = useTable(tables.company)
  const [page, setPage] = useState<'review' | 'inventory'>('review')

  if (!isActive) return <div className="connecting">Connecting…</div>

  const myEmployee = employees.find(e => identity && e.id.isEqual(identity))
  const myCompany = companies[0]

  if (!myEmployee) return <JoinCompany />

  return (
    <>
      <header className="header">
        <span className="header-logo">ir<em>i</em>s — {myCompany?.name ?? ''}</span>
        <button className={`nav-btn${page === 'review' ? ' active' : ''}`} onClick={() => setPage('review')}>Review Queue</button>
        <button className={`nav-btn${page === 'inventory' ? ' active' : ''}`} onClick={() => setPage('inventory')}>Inventory</button>
      </header>
      {page === 'review' ? <ReviewQueue /> : <InventoryPage />}
    </>
  )
}

export default function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <Main />
    </SpacetimeDBProvider>
  )
}
