import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bell, Boxes, CalendarClock, CalendarDays, LayoutDashboard, LayoutGrid, LogOut, Package, Settings, Truck, X } from 'lucide-react'
import { useAuth } from '../auth'
import { useRentAlerts } from '../lib/alerts'
import { fmtDateTime, relative } from '../lib/format'

const NAV = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/categories', 'Categories', LayoutGrid],
  ['/kits', 'Kits', Package],
  ['/reservations', 'Reservations', CalendarClock],
  ['/rent', 'Rent', Truck],
  ['/calendar', 'Calendar', CalendarDays],
  ['/settings', 'Settings', Settings],
]

const Brand = () => (
  <div className="brand"><div className="brand-mark"><Boxes size={18} /></div>Inventory</div>
)

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const { items, toasts, dismiss } = useRentAlerts()
  const [open, setOpen] = useState(false)

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav className="nav">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}><Icon size={18} />{label}</NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
          <div className="spacer" />
          <div className="bell">
            <button className="btn ghost icon" onClick={() => setOpen(!open)} aria-label="Return reminders">
              <Bell size={19} />
            </button>
            {items.length > 0 && <span className="dot">{items.length}</span>}
            {open && (
              <div className="card dropdown" onClick={() => setOpen(false)}>
                <div className="small muted" style={{ padding: '4px 10px 6px' }}>Rental returns due within 24 h</div>
                {items.length === 0 && <div className="small muted" style={{ padding: 10 }}>Nothing due soon.</div>}
                {items.map((r) => (
                  <Link key={r.id} to="/rent">
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="small" style={{ color: r.ms < 0 ? 'var(--bad)' : 'var(--hold)' }}>
                      {fmtDateTime(r.return_deadline)} · {relative(r.return_deadline)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="user-chip">
            <span className="user-name">{profile?.full_name}</span>
            <span className="role-pill">{profile?.role}</span>
          </div>
          <button className="btn ghost icon" onClick={signOut} title="Sign out"><LogOut size={18} /></button>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'}><Icon size={20} />{label}</NavLink>
        ))}
      </nav>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`card toast ${t.overdue ? 'overdue' : ''}`}>
            <Bell size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div className="small muted">{t.body}</div>
            </div>
            <button className="btn ghost sm icon" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
