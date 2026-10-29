import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { Field, Loading, Modal, StatusBadge, Thumb } from '../components/ui'
import { fmtDateTime } from '../lib/format'

const DAY = 864e5
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Local-date helpers (calendar days, not UTC).
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7)) // weeks start on Monday
const fmtDay = (d, opts) => d.toLocaleDateString('en-IN', opts)
const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

// Reservation period: from reserved_at until it was released, its deadline, or (open-ended holds) today.
function periodOf(r) {
  const start = new Date(r.reserved_at)
  let end = r.deadline ? new Date(r.deadline) : null
  if (!r.active && r.released_at && (!end || new Date(r.released_at) < end)) end = new Date(r.released_at)
  return { start, end, openEnded: !end }
}
const coversDay = (start, end, day) => {
  const dayStart = day.getTime()
  const dayEnd = dayStart + DAY - 1
  return start.getTime() <= dayEnd && (end ? end.getTime() : Date.now()) >= dayStart
}

const eventRange = (e) => [e.event_date, e.end_date && e.end_date > e.event_date ? e.end_date : e.event_date]
const eventOnDay = (e, key) => { const [a, b] = eventRange(e); return key >= a && key <= b }
const eventWhen = (e) => {
  const [a, b] = eventRange(e)
  const start = `${fmtDay(fromKey(a), { day: 'numeric', month: 'short', year: 'numeric' })}${e.start_time ? `, ${fmtTime(e.start_time)}` : ''}`
  const endDate = a === b ? '' : fmtDay(fromKey(b), { day: 'numeric', month: 'short', year: 'numeric' })
  const end = [endDate, fmtTime(e.end_time)].filter(Boolean).join(', ')
  return end ? `${start} – ${end}` : start
}

export default function Calendar() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()) })
  const [selected, setSelected] = useState(() => keyOf(new Date()))
  const [adding, setAdding] = useState(false)
  const [openEvent, setOpenEvent] = useState(null)

  async function load() {
    const [e, r] = await Promise.all([
      supabase.from('events').select('*').order('event_date'),
      supabase.from('reservations')
        .select('*, product:products(id,name,image_url), person:profiles(full_name), kit:kits(id,name)')
        .order('reserved_at', { ascending: false })
        .limit(1000),
    ])
    setData({ events: e.data || [], reservations: (r.data || []).map((x) => ({ ...x, period: periodOf(x) })) })
  }
  useEffect(() => { load() }, [])

  const todayKey = keyOf(new Date())
  const days = useMemo(() => {
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
    const first = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [view, cursor])

  if (!data) return <Loading />
  const eventsOn = (key) => data.events.filter((e) => eventOnDay(e, key))
  const reservationsOn = (day) => data.reservations.filter((r) => coversDay(r.period.start, r.period.end, day))

  const move = (n) => setCursor(view === 'week' ? addDays(cursor, 7 * n) : new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const goToday = () => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), t.getDate())); setSelected(todayKey) }
  const title = view === 'week'
    ? `${fmtDay(days[0], { day: 'numeric', month: 'short' })} – ${fmtDay(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmtDay(cursor, { month: 'long', year: 'numeric' })

  const selDay = fromKey(selected)
  const selEvents = eventsOn(selected)
  const selReservations = reservationsOn(selDay)
  const upcoming = data.events.filter((e) => eventRange(e)[1] >= todayKey).slice(0, 8)

  return (
    <>
      <div className="page-head">
        <div><h1>Calendar</h1><p>Events and reserved equipment by day, week and month.</p></div>
        <div className="spacer" />
        {isAdmin && <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} />Add event</button>}
      </div>

      <div className="cal-layout">
        <div className="card cal-card">
          <div className="cal-head">
            <button className="btn icon" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
            <button className="btn icon" onClick={() => move(1)} aria-label="Next"><ChevronRight size={18} /></button>
            <button className="btn sm" onClick={goToday}>Today</button>
            <h2 className="cal-title">{title}</h2>
            <div className="seg sm">
              {['month', 'week'].map((v) => (
                <button key={v} className={`available ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>{v === 'month' ? 'Month' : 'Week'}</button>
              ))}
            </div>
          </div>

          <div className={`cal-grid ${view}`}>
            {WEEKDAYS.map((w) => <div key={w} className="cal-dow">{w}</div>)}
            {days.map((d) => {
              const key = keyOf(d)
              const evs = eventsOn(key)
              const res = reservationsOn(d)
              const max = view === 'week' ? 8 : 2
              return (
                <button
                  key={key}
                  className={`cal-cell ${view === 'month' && d.getMonth() !== cursor.getMonth() ? 'out' : ''} ${key === todayKey ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="num">{d.getDate()}</span>
                  {evs.slice(0, max).map((e) => <span key={e.id} className="cal-chip" title={e.name}>{e.name}</span>)}
                  {evs.length > max && <span className="cal-more">+{evs.length - max} more</span>}
                  {view === 'week' && res.slice(0, max).map((r) => <span key={r.id} className="cal-chip res" title={r.product?.name}>{r.product?.name}</span>)}
                  {res.length > 0 && (view === 'month' || res.length > max) && (
                    <span className="cal-res">{view === 'week' ? `+${res.length - max} more` : `${res.length} reserved`}</span>
                  )}
                  <span className="cal-dots">{evs.length > 0 && <i className="ev" />}{res.length > 0 && <i className="rs" />}</span>
                </button>
              )
            })}
          </div>
          <div className="legend" style={{ paddingTop: 12 }}>
            <span><i style={{ background: 'var(--olive)' }} />Event</span>
            <span><i style={{ background: 'var(--res)' }} />Reserved / held item</span>
          </div>
        </div>

        <div className="stack cal-side">
          <div className="card">
            <div className="panel-head"><CalendarDays size={16} color="var(--olive)" /><h3>{fmtDay(selDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3></div>
            <div className="small muted" style={{ padding: '0 18px' }}>Events</div>
            <ul className="list">
              {selEvents.length === 0 && <li className="muted">No events on this day.</li>}
              {selEvents.map((e) => (
                <li key={e.id} style={{ cursor: 'pointer' }} onClick={() => setOpenEvent(e)}>
                  <div className="grow"><div className="t">{e.name}</div><div className="small muted">{eventWhen(e)}</div></div>
                </li>
              ))}
            </ul>
            <div className="small muted" style={{ padding: '0 18px' }}>Reserved products ({selReservations.length})</div>
            <ul className="list">
              {selReservations.length === 0 && <li className="muted">No products reserved on this day.</li>}
              {selReservations.map((r) => (
                <li key={r.id}>
                  <Thumb src={r.product?.image_url} />
                  <div className="grow">
                    <Link to={`/product/${r.product_id}`} className="t" style={{ display: 'block' }}>{r.product?.name}</Link>
                    <div className="small muted">
                      {fmtDateTime(r.period.start)} – {r.period.openEnded ? 'no end date' : fmtDateTime(r.period.end)}
                    </div>
                    <div className="small muted">{r.person?.full_name}{r.kit ? ` · Kit: ${r.kit.name}` : ''}</div>
                  </div>
                  {r.active ? <StatusBadge status={r.status} /> : <span className="badge neutral">Released</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <div className="panel-head"><Clock size={16} color="var(--olive)" /><h3>Upcoming events</h3></div>
            <ul className="list">
              {upcoming.length === 0 && <li className="muted">No upcoming events.</li>}
              {upcoming.map((e) => {
                const dt = fromKey(e.event_date)
                return (
                  <li key={e.id} style={{ cursor: 'pointer' }} onClick={() => { setSelected(e.event_date); setCursor(dt) }}>
                    <div className="date-box"><b>{dt.getDate()}</b><span>{dt.toLocaleString('en', { month: 'short' })}</span></div>
                    <div className="grow"><div className="t">{e.name}</div><div className="small muted">{eventWhen(e)}</div></div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      {adding && <EventForm defaultDate={selected} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
      {openEvent && (
        <Modal
          title={openEvent.name}
          onClose={() => setOpenEvent(null)}
          footer={isAdmin && (
            <button className="btn danger" onClick={async () => {
              if (!confirm(`Delete event "${openEvent.name}"?`)) return
              await supabase.from('events').delete().eq('id', openEvent.id)
              setOpenEvent(null)
              load()
            }}><Trash2 size={15} />Delete event</button>
          )}
        >
          <table className="spec"><tbody>
            <tr><td>Starts</td><td>{fmtDay(fromKey(openEvent.event_date), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{openEvent.start_time ? `, ${fmtTime(openEvent.start_time)}` : ''}</td></tr>
            <tr><td>Ends</td><td>{fmtDay(fromKey(eventRange(openEvent)[1]), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{openEvent.end_time ? `, ${fmtTime(openEvent.end_time)}` : ''}</td></tr>
            {openEvent.location && <tr><td>Location</td><td>{openEvent.location}</td></tr>}
            {openEvent.description && <tr><td>Details</td><td style={{ whiteSpace: 'pre-wrap' }}>{openEvent.description}</td></tr>}
          </tbody></table>
        </Modal>
      )}
    </>
  )
}

function EventForm({ defaultDate, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', event_date: defaultDate, start_time: '', end_date: defaultDate, end_time: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save() {
    if (!f.name.trim() || !f.event_date) return setError('Event name and start date are required')
    if (f.end_date && f.end_date < f.event_date) return setError('End date cannot be before the start date')
    setBusy(true)
    const { error } = await supabase.from('events').insert({
      name: f.name.trim(),
      event_date: f.event_date,
      start_time: f.start_time || null,
      end_date: f.end_date || null,
      end_time: f.end_time || null,
      location: f.location.trim() || null,
      description: f.description.trim() || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal
      title="Add event"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save event'}</button>
      </>}
    >
      <Field label="Event name *"><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Sharma wedding" /></Field>
      <div className="grid-2">
        <Field label="Start date *"><input className="input" type="date" value={f.event_date} onChange={set('event_date')} /></Field>
        <Field label="Start time"><input className="input" type="time" value={f.start_time} onChange={set('start_time')} /></Field>
        <Field label="End date"><input className="input" type="date" value={f.end_date} onChange={set('end_date')} /></Field>
        <Field label="End time"><input className="input" type="time" value={f.end_time} onChange={set('end_time')} /></Field>
      </div>
      <Field label="Location"><div style={{ position: 'relative' }}><MapPin size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--muted)' }} /><input className="input" style={{ paddingLeft: 32 }} value={f.location} onChange={set('location')} /></div></Field>
      <Field label="Details"><textarea className="input" value={f.description} onChange={set('description')} placeholder="Client, equipment notes, contacts…" /></Field>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}
