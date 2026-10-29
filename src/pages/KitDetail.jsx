import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import StatusControl from '../components/StatusControl'
import { Field, Img, Loading, Modal, StatusBadge } from '../components/ui'
import { fmtDateTime, fromLocalInput } from '../lib/format'
import { KitForm } from './Kits'

export default function KitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [d, setD] = useState(null)
  const [editing, setEditing] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function load() {
    const { data: kit } = await supabase
      .from('kits')
      .select('*, owner:profiles(full_name), items:kit_items(product:products(*, category:categories(name)))')
      .eq('id', id)
      .single()
    const ids = (kit?.items || []).map((i) => i.product?.id).filter(Boolean)
    const { data: res } = ids.length
      ? await supabase.from('reservations').select('*, person:profiles(full_name)').eq('active', true).in('product_id', ids)
      : { data: [] }
    setD({ kit, reservations: Object.fromEntries((res || []).map((r) => [r.product_id, r])) })
  }
  useEffect(() => { load() }, [id])

  if (!d) return <Loading />
  const { kit, reservations } = d
  if (!kit) return <div className="card empty">Kit not found.</div>
  const canManage = isAdmin || kit.owner_id === user.id
  const items = kit.items.map((i) => i.product).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))

  async function removeItem(pid) {
    await supabase.from('kit_items').delete().eq('kit_id', id).eq('product_id', pid)
    load()
  }
  async function reserveAll() {
    setBusy(true)
    let done = 0
    const skipped = []
    const failed = []
    for (const p of items) {
      const r = reservations[p.id]
      if (r && r.user_id !== user.id) { skipped.push(p.name); continue }
      const { error } = await supabase.rpc('set_product_status', {
        p_product: p.id, p_status: 'reserved', p_deadline: fromLocalInput(deadline), p_kit: kit.id,
      })
      error ? failed.push(p.name) : done++
    }
    setBusy(false)
    setReserving(false)
    setResult([
      `Reserved ${done} of ${items.length} items until ${fmtDateTime(fromLocalInput(deadline))}.`,
      skipped.length && `Skipped (held/reserved by someone else): ${skipped.join(', ')}.`,
      failed.length && `Could not reserve: ${failed.join(', ')}.`,
    ].filter(Boolean).join(' '))
    load()
  }

  async function removeKit() {
    if (!confirm(`Delete kit "${kit.name}"? Products stay in inventory.`)) return
    await supabase.from('kits').delete().eq('id', id)
    navigate('/kits')
  }

  return (
    <>
      <div className="crumbs"><Link to="/kits">Kits</Link> / <b>{kit.name}</b></div>
      <button className="btn ghost sm" style={{ marginBottom: 12, paddingLeft: 0 }} onClick={() => navigate('/kits')}><ArrowLeft size={16} />All kits</button>
      <div className="page-head">
        <div>
          <h1>{kit.name}</h1>
          <p>{kit.description ? `${kit.description} · ` : ''}Created by {kit.owner?.full_name} · {items.length} items</p>
        </div>
        <div className="spacer" />
        <div className="row wrap">
          <button className="btn primary" disabled={items.length === 0} onClick={() => { setResult(''); setReserving(true) }}><Lock size={15} />Reserve all</button>
          {canManage && (
            <>
              <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} />Add / remove items</button>
              <button className="btn danger" onClick={removeKit}><Trash2 size={15} />Delete</button>
            </>
          )}
        </div>
      </div>
      {result && <div className="notice" style={{ marginBottom: 16 }}>{result}</div>}

      {reserving && (
        <Modal
          title={`Reserve all items in ${kit.name}`}
          onClose={() => setReserving(false)}
          footer={<>
            <button className="btn" onClick={() => setReserving(false)}>Cancel</button>
            <button className="btn primary" disabled={!deadline || busy} onClick={reserveAll}>{busy ? 'Reserving…' : `Reserve ${items.length} items`}</button>
          </>}
        >
          <Field label="Reservation deadline *">
            <input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <div className="small muted">Items already held or reserved by someone else are skipped.</div>
        </Modal>
      )}

      {items.length === 0 && <div className="card empty">This kit has no items yet.</div>}
      <div className="stack" style={{ gap: 10 }}>
        {items.map((p) => {
          const r = reservations[p.id]
          return (
            <div key={p.id} className="card rcard" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Link to={`/product/${p.id}`} className="thumb lg"><Img src={p.image_url} size={20} /></Link>
              <div className="grow">
                <div className="row wrap">
                  <Link to={`/product/${p.id}`} style={{ fontWeight: 600 }}>{p.name}</Link>
                  <StatusBadge status={p.status} />
                  {p.damaged && <span className="badge damaged">Damaged</span>}
                </div>
                <div className="small muted">
                  {p.category?.name || 'Unassigned'}
                  {r && <> · {r.person?.full_name}{r.deadline ? ` until ${fmtDateTime(r.deadline)}` : ''}</>}
                </div>
              </div>
              <StatusControl product={p} reservation={r} kitId={kit.id} onChange={load} size="sm" />
              {canManage && <button className="btn ghost icon sm" title="Remove from kit" onClick={() => removeItem(p.id)}><X size={16} /></button>}
            </div>
          )
        })}
      </div>

      {editing && (
        <KitForm kit={kit} initialIds={items.map((p) => p.id)} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
      )}
    </>
  )
}
