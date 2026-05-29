import { useState, useEffect, useRef } from 'react'
import { SpacetimeDBProvider, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import './App.css'

const savedToken = localStorage.getItem('iris_token') ?? undefined

const connectionBuilder = DbConnection.builder()
  .withUri('http://localhost:3000')
  .withDatabaseName('iris')
  .withCompression('none')
  .withToken(savedToken)

// ── Image ─────────────────────────────────────────────────

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

  if (failed || !src) {
    return <div className="img-wrap img-placeholder"><span>No image</span></div>
  }

  return (
    <div className="img-wrap">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </div>
  )
}

// ── Sign up ───────────────────────────────────────────────

function SignUp() {
  const { getConnection } = useSpacetimeDB()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function handleSignUp() {
    if (!name.trim() || !email.trim()) return
    getConnection()?.reducers.createUser({ name: name.trim(), email: email.trim() })
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-logo">ir<em>i</em>s</div>
        <p className="join-sub">Create your account to get started</p>
        <input
          className="join-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
        />
        <input
          className="join-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignUp()}
          placeholder="Email address"
          type="email"
        />
        <button className="join-btn" onClick={handleSignUp}>Create Account</button>
      </div>
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
  const [items] = useTable(tables.processed_image)

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

// ── Capture ───────────────────────────────────────────────

function CapturePage() {
  const { getConnection } = useSpacetimeDB()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'sent'>('idle')

  useEffect(() => {
    let stream: MediaStream | undefined
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
        }
      })
      .catch(err => console.error('Camera error:', err))
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      blob.arrayBuffer().then(buf => {
        getConnection()?.reducers.uploadImage({ imageBytes: new Uint8Array(buf) })
        setStatus('sent')
        setTimeout(() => setStatus('idle'), 1500)
      })
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Capture</h2>
      </div>
      <div className="capture-zone">
        <video ref={videoRef} className="capture-video" autoPlay playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      <button className="btn btn-confirm capture-upload-btn" onClick={handleCapture}>
        {status === 'sent' ? 'Sent!' : 'Take Photo'}
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────

function Main() {
  const { isActive, token } = useSpacetimeDB()

  useEffect(() => {
    if (token) localStorage.setItem('iris_token', token)
  }, [token])

  const [myUserRows] = useTable(tables.my_user)
  const [myEmployeeRows] = useTable(tables.my_employee)
  const [companies] = useTable(tables.company)
  const [page, setPage] = useState<'review' | 'inventory' | 'capture'>('review')

  if (!isActive) return <div className="connecting">Connecting…</div>

  const myUser = myUserRows[0]
  const myEmployee = myEmployeeRows[0]
  const myCompany = companies[0]

  if (!myUser) return <SignUp />
  if (!myEmployee) return <JoinCompany />

  return (
    <>
      <header className="header">
        <span className="header-logo">ir<em>i</em>s — {myCompany?.name ?? ''}</span>
        <button className={`nav-btn${page === 'review' ? ' active' : ''}`} onClick={() => setPage('review')}>Review Queue</button>
        <button className={`nav-btn${page === 'inventory' ? ' active' : ''}`} onClick={() => setPage('inventory')}>Inventory</button>
        <button className={`nav-btn${page === 'capture' ? ' active' : ''}`} onClick={() => setPage('capture')}>Capture</button>
      </header>
      {page === 'review' ? <ReviewQueue /> : page === 'inventory' ? <InventoryPage /> : <CapturePage />}
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
