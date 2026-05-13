import { useState } from 'react'
import { SpacetimeDBProvider, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import './App.css'

const connectionBuilder = DbConnection.builder()
  .withUri('ws://localhost:3000')
  .withDatabaseName('iris')

function CompanySetup() {
  const { getConnection } = useSpacetimeDB()
  const [view, setView] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const conn = getConnection()

  function handleCreate() {
    if (!name.trim()) return
    conn?.reducers.createCompany({ name })
    setName('')
  }

  function handleJoin() {
    if (!code.trim()) return
    conn?.reducers.joinCompany({ code })
    setCode('')
  }

  return (
    <div className="setup-container">
      <h1>Iris</h1>
      <div className="tabs">
        <button className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}>Create Company</button>
        <button className={view === 'join' ? 'active' : ''} onClick={() => setView('join')}>Join Company</button>
      </div>
      {view === 'create' ? (
        <div className="form-row">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="Company name" />
          <button onClick={handleCreate}>Create</button>
        </div>
      ) : (
        <div className="form-row">
          <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="Invite code" />
          <button onClick={handleJoin}>Join</button>
        </div>
      )}
    </div>
  )
}

function CompanyDashboard({ name, code }: { name: string; code: string }) {
  return (
    <div className="dashboard-container">
      <h1>{name}</h1>
      <p className="invite-code">Invite code: <code>{code}</code></p>
    </div>
  )
}

function Main() {
  const { isActive, identity } = useSpacetimeDB()
  const [employees, employeesReady] = useTable(tables.employee)
  const [companies, companiesReady] = useTable(tables.company)

  if (!isActive || !employeesReady || !companiesReady) {
    return <p>Connecting...</p>
  }

  const myEmployee = employees.find(e => identity && e.id.isEqual(identity))
  const myCompany = companies.find(c => myEmployee && c.id === myEmployee.companyId)

  if (!myEmployee) return <CompanySetup />

  return <CompanyDashboard name={myCompany?.name ?? ''} code={myCompany?.code ?? ''} />
}

function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <Main />
    </SpacetimeDBProvider>
  )
}

export default App
