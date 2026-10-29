import { useEffect, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { notifyRentChanged } from '../lib/alerts'
import { Field, Img, Loading, Modal } from '../components/ui'
import SearchButton, { useRecordHighlight } from '../components/SearchButton'
import DamageButton from '../components/DamageButton'
import { fmtDateTime, fmtMoney, fromLocalInput, relative, toLocalInput } from '../lib/format'

const DAY = 864e5

export default function Rent() {
  const { user, isAdmin } = useAuth()
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null)
  const [hit, highlight] = useRecordHighlight()
  const [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'unsupported')

  async function load() {
    const { data } = await supabase.from('rentals').select('*, owner:profiles(full_name)').order('return_deadline')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])
  const changed = () => { setEditing(null); load(); notifyRentChanged() }

  async function markReturned(r, returned) {
    await supabase.from('rentals').update({ returned }).eq('id', r.id)
    changed()
  }
  async function remove(r) {
    if (!confirm(`Delete "${r.name}"?`)) return
    await supabase.from('rentals').delete().eq('id', r.id)
    changed()
  }

  if (!rows) return <Loading />
  const now = Date.now()
  const open = rows.filter((r) => !r.returned)
  const groups = [
    ['Overdue', open.filter((r) => new Date(r.return_deadline) < now), AlertTriangle, 'var(--bad)'],
    ['Due within 24 hours', open.filter((r) => { const ms = new Date(r.return_deadline) - now; return ms >= 0 && ms < DAY }), Clock, 'var(--hold)'],
    ['Upcoming returns', open.filter((r) => new Date(r.return_deadline) - now >= DAY), Clock, 'var(--olive)'],
    ['Returned', rows.filter((r) => r.returned), CheckCircle2, 'var(--muted)'],
  ]
  const canManage = (r) => isAdmin || r.owner_id === user.id

  return (
    <>
      <div className="page-head">
        <div><h1>Rent</h1><p>Equipment borrowed or rented from external sources.</p></div>
        <div className="spacer" />
        <SearchButton
          placeholder="Search rented or borrowed items"
          items={rows.map((r) => ({
            key: r.id,
            title: r.name,
            subtitle: `${r.returned ? 'Returned' : `Return by ${fmtDateTime(r.return_deadline)}`}${r.source ? ` · ${r.source}` : ''}`,
            image: r.image_url,
            text: `${r.name} ${r.description || ''} ${r.source || ''} ${r.owner?.full_name || ''}`,
            onSelect: () => highlight(r.id),
          }))}
        />
        {perm === 'default' && (
          <button className="btn" onClick={() => Notification.requestPermission().then(setPerm)}><BellRing size={16} />Enable reminders</button>
        )}
        <button className="btn primary" onClick={() => setEditing({})}><Plus size={16} />Add rented item</button>
      </div>

      {rows.length === 0 && <div className="card empty">No rented or borrowed equipment yet.</div>}
      {groups.map(([title, list, Icon, color]) => list.length > 0 && (
        <section key={title}>
          <div className="section-title"><Icon size={17} color={color} /><h2>{title}</h2><span className="muted">({list.length})</span></div>
          <div className="rent-grid">
            {list.map((r) => {
              const late = !r.returned && new Date(r.return_deadline) < now
              const soon = !r.returned && !late && new Date(r.return_deadline) - now < DAY
              return (
                <div key={r.id} data-record={r.id} className={`card rent-card ${late ? 'overdue' : ''} ${hit === r.id ? 'search-hit' : ''}`} style={r.returned ? { opacity: 0.7 } : undefined}>
                  <div className="img-box"><Img src={r.image_url} alt={r.name} />
                    {late && <span className="badge overdue">Overdue</span>}
                    {soon && <span className="badge hold">Due soon</span>}
                    {r.damaged && <span className="badge damaged damaged-flag">Damaged</span>}
                  </div>
                  <div className="body">
                    <h3>{r.name}</h3>
                    {r.description && <div className="small muted">{r.description}</div>}
                    {r.source && <div className="small">From: {r.source}</div>}
                    <div className="row" style={{ marginTop: 4 }}>
                      <div>
                        <div className="small muted">Return by</div>
                        <div style={{ fontWeight: 600 }}>{fmtDateTime(r.return_deadline)}</div>
                        {!r.returned && <div className="small" style={{ color: late ? 'var(--bad)' : soon ? 'var(--hold)' : 'var(--muted)' }}>{relative(r.return_deadline)}</div>}
                      </div>
                      <div className="spacer" />
                      <div style={{ textAlign: 'right' }}>
                        <div className="small muted">Cost</div>
                        <div style={{ fontWeight: 600 }}>{fmtMoney(r.cost)}</div>
                      </div>
                    </div>
                    <div className="small muted">Added by {r.owner_id === user.id ? 'you' : r.owner?.full_name}</div>
                    {canManage(r) && (
                      <div className="row" style={{ marginTop: 'auto', paddingTop: 8 }}>
                        <button className="btn sm" onClick={() => markReturned(r, !r.returned)}>{r.returned ? 'Undo return' : 'Mark returned'}</button>
                        <div className="spacer" />
                        <DamageButton rental={r} onChange={load} small />
                        <button className="btn ghost icon sm" onClick={() => setEditing(r)}><Pencil size={15} /></button>
                        <button className="btn ghost icon sm danger" onClick={() => remove(r)}><Trash2 size={15} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {editing && <RentForm item={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={changed} />}
    </>
  )
}

function RentForm({ item, onClose, onSaved }) {
  const [f, setF] = useState({
    name: item?.name || '',
    description: item?.description || '',
    image_url: item?.image_url || '',
    source: item?.source || '',
    return_deadline: toLocalInput(item?.return_deadline),
    cost: item?.cost ?? '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save() {
    if (!f.name.trim() || !f.return_deadline) return setError('Name and return deadline are required')
    setBusy(true)
    const row = {
      name: f.name.trim(),
      description: f.description || null,
      image_url: f.image_url || null,
      source: f.source || null,
      return_deadline: fromLocalInput(f.return_deadline),
      cost: f.cost === '' ? null : Number(f.cost),
    }
    const { error } = item
      ? await supabase.from('rentals').update(row).eq('id', item.id)
      : await supabase.from('rentals').insert(row)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal
      title={item ? 'Edit rented item' : 'Add rented item'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>Save</button>
      </>}
    >
      <Field label="Product name"><input className="input" value={f.name} onChange={set('name')} /></Field>
      <Field label="Description"><textarea className="input" value={f.description} onChange={set('description')} /></Field>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><Field label="Image link"><input className="input" value={f.image_url} onChange={set('image_url')} placeholder="https://…" /></Field></div>
        <div className="thumb lg"><Img src={f.image_url} size={20} /></div>
      </div>
      <Field label="Rented from"><input className="input" value={f.source} onChange={set('source')} placeholder="Vendor or person" /></Field>
      <div className="grid-2">
        <Field label="Return deadline"><input className="input" type="datetime-local" value={f.return_deadline} onChange={set('return_deadline')} /></Field>
        <Field label="Rental cost (₹)"><input className="input" type="number" min="0" value={f.cost} onChange={set('cost')} /></Field>
      </div>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}
