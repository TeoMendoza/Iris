import { useState } from 'react'
import { useSpacetimeDB } from 'spacetimedb/react'

export function SignUp() {
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

export function JoinCompany() {
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
