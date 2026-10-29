import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Lock, Package, Plus, Trash2, Truck } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { Loading, StatusBadge, Thumb } from '../components/ui'
import { fmtDateTime, relative } from '../lib/format'

const COLORS = { available: '#5b6b2f', hold: '#d39b2a', reserved: '#6b8fbf' }
const LABEL = { available: 'Available', hold: 'On hold', reserved: 'Reserved' }

export default function Dashboard() {
  const { isAdmin } = useAuth()
  const [d, setD] = useState(null)
  const [ev, setEv] = useState({ name: '', event_date: '', location: '' })

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const [p, c, e, r, res] = await Promise.all([
      supabase.from('products').select('id,name,image_url,status,damaged,category_id'),
      supabase.from('categories').select('id,name'),
      supabase.from('events').select('*').gte('event_date', today).order('event_date').limit(8),
      supabase.from('rentals').select('*').eq('returned', false).order('return_deadline'),
      supabase.from('reservations').select('*, product:products(name,image_url,status), person:profiles(full_name)').eq('active', true).order('deadline', { nullsFirst: false }),
    ])
    setD({ products: p.data || [], categories: c.data || [], events: e.data || [], rentals: r.data || [], reservations: res.data || [] })
  }
  useEffect(() => { load() }, [])

  async function addEvent(e) {
    e.preventDefault()
    if (!ev.name || !ev.event_date) return
    await supabase.from('events').insert({ ...ev, location: ev.location || null })
    setEv({ name: '', event_date: '', location: '' })
    load()
  }
  async function deleteEvent(id) {
    await supabase.from('events').delete().eq('id', id)
    load()
  }

  if (!d) return <Loading />
  const count = (s) => d.products.filter((p) => p.status === s).length
  const damaged = d.products.filter((p) => p.damaged)
  const pie = ['available', 'hold', 'reserved'].map((s) => ({ key: s, name: LABEL[s], value: count(s) }))
  const bars = d.categories
    .map((c) => {
      const items = d.products.filter((p) => p.category_id === c.id)
      return { name: c.name, available: items.filter((p) => p.status === 'available').length, hold: items.filter((p) => p.status === 'hold').length, reserved: items.filter((p) => p.status === 'reserved').length, total: items.length }
    })
    .filter((b) => b.total)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
  const overdueRentals = d.rentals.filter((r) => new Date(r.return_deadline) < new Date()).length

  const stats = [
    ['Total items', d.products.length, Package],
    ['Available', count('available'), CheckCircle2],
    ['On hold', count('hold'), Clock],
    ['Reserved', count('reserved'), Lock],
    ['Damaged', damaged.length, AlertTriangle],
    ['Borrowed', d.rentals.length, Truck],
  ]

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Overall status of your inventory.</p></div>
      </div>

      <div className="stats">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="card stat">
            <div className="lbl"><span className="ico"><Icon size={15} /></span>{label}</div>
            <div className="val">{value}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card span-5">
          <div className="panel-head"><h3>Inventory status</h3></div>
          <div style={{ height: 230, position: 'relative' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                  {pie.map((s) => <Cell key={s.key} fill={COLORS[s.key]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
              <div><div style={{ fontSize: 26, fontWeight: 700 }}>{d.products.length}</div><div className="small muted">items</div></div>
            </div>
          </div>
          <div className="legend">
            {pie.map((s) => <span key={s.key}><i style={{ background: COLORS[s.key] }} />{s.name} · {s.value}</span>)}
          </div>
        </div>

        <div className="card span-7">
          <div className="panel-head"><h3>Items by category</h3></div>
          <div style={{ height: 270, padding: '0 12px 12px 0' }}>
            {bars.length ? (
              <ResponsiveContainer>
                <BarChart data={bars} margin={{ top: 10, left: 0, right: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} interval={0} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} />
                  {['available', 'hold', 'reserved'].map((s, i) => (
                    <Bar key={s} dataKey={s} name={LABEL[s]} stackId="a" fill={COLORS[s]} radius={i === 2 ? [4, 4, 0, 0] : 0} maxBarSize={40} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty">No products yet.</div>}
          </div>
        </div>

        <div className="card span-4">
          <div className="panel-head"><CalendarDays size={16} color="var(--olive)" /><h3>Upcoming events</h3></div>
          {isAdmin && (
            <form onSubmit={addEvent} className="row wrap" style={{ padding: '6px 18px' }}>
              <input className="input" style={{ flex: '1 1 140px' }} placeholder="Event name" value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} />
              <input className="input" style={{ flex: '1 1 130px' }} type="date" value={ev.event_date} onChange={(e) => setEv({ ...ev, event_date: e.target.value })} />
              <button className="btn primary icon"><Plus size={16} /></button>
            </form>
          )}
          <ul className="list">
            {d.events.length === 0 && <li className="muted">No upcoming events.</li>}
            {d.events.map((e) => {
              const dt = new Date(e.event_date + 'T00:00')
              return (
                <li key={e.id}>
                  <div className="date-box"><b>{dt.getDate()}</b><span>{dt.toLocaleString('en', { month: 'short' })}</span></div>
                  <div className="grow"><div className="t">{e.name}</div><div className="small muted">{dt.toLocaleDateString('en-IN', { weekday: 'long' })}</div></div>
                  {isAdmin && <button className="btn ghost icon sm" onClick={() => deleteEvent(e.id)}><Trash2 size={14} /></button>}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card span-4">
          <div className="panel-head">
            <Truck size={16} color="var(--olive)" /><h3>Borrowed equipment</h3><div className="spacer" />
            {overdueRentals > 0 && <span className="badge overdue">{overdueRentals} overdue</span>}
          </div>
          <ul className="list">
            {d.rentals.length === 0 && <li className="muted">Nothing borrowed right now.</li>}
            {d.rentals.slice(0, 6).map((r) => {
              const late = new Date(r.return_deadline) < new Date()
              return (
                <li key={r.id}>
                  <Thumb src={r.image_url} />
                  <div className="grow"><div className="t">{r.name}</div><div className="small muted">Return {fmtDateTime(r.return_deadline)}</div></div>
                  <span className={`badge ${late ? 'overdue' : 'neutral'}`}>{relative(r.return_deadline)}</span>
                </li>
              )
            })}
          </ul>
          {d.rentals.length > 6 && <div style={{ padding: '0 18px 14px' }}><Link to="/rent" className="small" style={{ color: 'var(--olive)' }}>View all →</Link></div>}
        </div>

        <div className="card span-4">
          <div className="panel-head"><Lock size={16} color="var(--olive)" /><h3>Reserved &amp; held</h3></div>
          <ul className="list">
            {d.reservations.length === 0 && <li className="muted">No active reservations.</li>}
            {d.reservations.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Thumb src={r.product?.image_url} />
                <div className="grow"><div className="t">{r.product?.name}</div><div className="small muted">{r.person?.full_name}{r.deadline ? ` · until ${fmtDateTime(r.deadline)}` : ''}</div></div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
          {d.reservations.length > 6 && <div style={{ padding: '0 18px 14px' }}><Link to="/reservations" className="small" style={{ color: 'var(--olive)' }}>View all →</Link></div>}
        </div>

        <div className="card span-6">
          <div className="panel-head"><AlertTriangle size={16} color="var(--bad)" /><h3>Damaged items</h3></div>
          <ul className="list">
            {damaged.length === 0 && <li className="muted">No damaged items. 👍</li>}
            {damaged.map((p) => (
              <li key={p.id}>
                <Thumb src={p.image_url} />
                <div className="grow"><Link to={`/product/${p.id}`} className="t">{p.name}</Link></div>
                <span className="badge damaged">Damaged</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
