import type { Page } from '../types'
import { Icon, ICONS, PAGE_LABELS } from './Icon'

export function Sidebar({ page, setPage, companyName, userName, reviewCount }: { page: Page; setPage: (p: Page) => void; companyName: string; userName: string; reviewCount: number }) {
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
            {p === 'review' && reviewCount > 0 && <span className="nav-badge">{reviewCount}</span>}
          </button>
        ))}
      </nav>
      {userName && <div className="sidebar-footer"><div className="sidebar-user">{userName}</div></div>}
    </aside>
  )
}

export function BottomNav({ page, setPage, reviewCount }: { page: Page; setPage: (p: Page) => void; reviewCount: number }) {
  return (
    <nav className="bottom-nav">
      {(Object.keys(PAGE_LABELS) as Page[]).map(p => (
        <button key={p} className={`bottom-nav-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>
          <span className="bottom-nav-icon-wrap">
            <Icon d={ICONS[p]} size={20} />
            {p === 'review' && reviewCount > 0 && <span className="nav-badge nav-badge-sm">{reviewCount}</span>}
          </span>
          {PAGE_LABELS[p].split(' ')[0]}
        </button>
      ))}
    </nav>
  )
}
