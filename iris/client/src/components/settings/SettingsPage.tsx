import { useState } from 'react'
import { useTable } from 'spacetimedb/react'
import { tables } from '../../module_bindings'

export function SettingsPage() {
  const [companies] = useTable(tables.company)
  const [myUserRows] = useTable(tables.my_user)
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
      </div>
    </div>
  )
}
