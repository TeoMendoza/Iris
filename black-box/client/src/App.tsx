import { useState } from 'react'
import { SpacetimeDBProvider, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { DbConnection, tables } from './module_bindings'
import './App.css'

const connectionBuilder = DbConnection.builder()
  .withUri('ws://localhost:3000')
  .withDatabaseName('black-box')
  .onConnect((conn: DbConnection) => {
    conn.subscriptionBuilder().subscribe(tables.person)
  })

function Main() {
  const { isActive, getConnection } = useSpacetimeDB()
  const [persons, isReady] = useTable(tables.person)
  const [name, setName] = useState('')
  const conn = getConnection()

  if (!isActive || !isReady) return <p>Connecting to SpacetimeDB...</p>

  function handleAdd() {
    if (!name.trim()) return
    conn?.reducers.add({ name })
    setName('')
  }

  return (
    <div>
      <h1>Black Box</h1>
      <ul>
        {persons.map((p, i) => <li key={i}>{p.name}</li>)}
      </ul>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Enter name"
      />
      <button onClick={handleAdd}>Add Person</button>
      <button onClick={() => conn?.reducers.sayHello({})}>Say Hello (check server logs)</button>
    </div>
  )
}

function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <Main />
    </SpacetimeDBProvider>
  )
}

export default App
