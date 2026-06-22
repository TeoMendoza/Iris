import { useState, useEffect } from 'react'
import { SpacetimeDBProvider, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import type { Page } from './types'
import { Sidebar, BottomNav } from './components/Layout'
import { SignUp, JoinCompany } from './components/Auth'
import { Icon, CAMERA_ICON } from './components/Icon'
import { CameraModal } from './components/CameraModal'
import { ReviewQueue } from './components/review/ReviewQueue'
import { InventoryPage } from './components/inventory/InventoryPage'
import { AnalyticsPage } from './components/analytics/AnalyticsPage'
import { SettingsPage } from './components/settings/SettingsPage'
import './App.css'

const savedToken = localStorage.getItem('iris_token') ?? undefined

const connectionBuilder = DbConnection.builder()
  .withUri('https://maincloud.spacetimedb.com')
  .withDatabaseName('iris-logistics')
  .withCompression('none')
  .withToken(savedToken)

function GlobalSubscriptions() {
  useTable(tables.inventory_categories)
  useTable(tables.stock_entries)
  return null
}

function CameraFab() {
  const { getConnection } = useSpacetimeDB()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="camera-fab" onClick={() => setOpen(true)}>
        <Icon d={CAMERA_ICON} size={24} />
      </button>
      {open && (
        <CameraModal
          title="Take Photo"
          onCapture={bytes => getConnection()?.reducers.uploadPhoto({ imageBytes: bytes })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function Main() {
  const { isActive, token } = useSpacetimeDB()
  useEffect(() => { if (token) localStorage.setItem('iris_token', token) }, [token])

  const [myUserRows] = useTable(tables.my_user)
  const [myEmployeeRows] = useTable(tables.my_employee)
  const [companies] = useTable(tables.company)
  const [reviewItems] = useTable(tables.review_queue)
  const [page, setPage] = useState<Page>('inventory')

  if (!isActive) return <div className="connecting">Connecting…</div>

  const myUser = myUserRows[0]
  const myEmployee = myEmployeeRows[0]
  const myCompany = companies[0]

  if (!myUser) return <SignUp />
  if (!myEmployee) return <JoinCompany />

  const reviewCount = reviewItems.length

  return (
    <div className="app-shell">
      <GlobalSubscriptions />
      <Sidebar page={page} setPage={setPage} companyName={(myCompany as { name?: string })?.name ?? ''} userName={(myUser as { name?: string })?.name ?? ''} reviewCount={reviewCount} />
      <main className="content">
        {page === 'inventory' && <InventoryPage />}
        {page === 'review' && <ReviewQueue />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      <BottomNav page={page} setPage={setPage} reviewCount={reviewCount} />
      <CameraFab />
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
