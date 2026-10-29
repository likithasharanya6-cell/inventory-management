import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import StatusControl from '../components/StatusControl'
import ProductForm from '../components/ProductForm'
import DamageButton from '../components/DamageButton'
import { Img, Loading, StatusBadge } from '../components/ui'
import { fmtDate, fmtDateTime, fmtMoney, relative } from '../lib/format'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [d, setD] = useState(null)
  const [editing, setEditing] = useState(false)

  async function load() {
    const [p, c, r, fix] = await Promise.all([
      supabase.from('products').select('*, category:categories(id,name)').eq('id', id).single(),
      supabase.from('categories').select('*').order('name'),
      supabase.from('reservations').select('*, person:profiles(full_name)').eq('product_id', id).eq('active', true).maybeSingle(),
      supabase.from('damage_log').select('reason,created_at').eq('product_id', id).eq('action', 'resolved').order('created_at', { ascending: false }).limit(1),
    ])
    setD({ product: p.data, categories: c.data || [], reservation: r.data, lastRepair: fix.data?.[0] })
  }
  useEffect(() => { load() }, [id])

  async function remove() {
    if (!confirm(`Delete "${d.product.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) return alert(error.message)
    navigate('/categories')
  }

  if (!d) return <Loading />
  const { product: p, reservation: r } = d
  if (!p) return <div className="card empty">Product not found.</div>

  const rows = [
    ['Category', p.category?.name || 'Unassigned'],
    ['Price', fmtMoney(p.price)],
    ['Condition', p.damaged ? 'Damaged' : 'Good'],
    ...(d.lastRepair ? [['Last repair', `${d.lastRepair.reason} (${fmtDate(d.lastRepair.created_at)})`]] : []),
    ...Object.entries(p.details || {}),
    ['Added', fmtDate(p.created_at)],
  ]

  return (
    <>
      <div className="crumbs">
        <Link to="/categories">Categories</Link>
        {p.category && <> / <Link to={`/categories?cat=${p.category.id}`}>{p.category.name}</Link></>} / <b>{p.name}</b>
      </div>
      <button className="btn ghost sm" style={{ marginBottom: 12, paddingLeft: 0 }} onClick={() => navigate(-1)}><ArrowLeft size={16} />Back</button>

      <div className="detail">
        <div className="img-box"><Img src={p.image_url} alt={p.name} size={64} /></div>

        <div className="stack">
          <div>
            {p.category && <div className="small" style={{ color: 'var(--olive)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{p.category.name}</div>}
            <h1 style={{ fontSize: 26, margin: '4px 0 8px' }}>{p.name}</h1>
            <div className="row wrap">
              <StatusBadge status={p.status} />
              {p.damaged && <span className="badge damaged">Damaged</span>}
            </div>
          </div>
          <div className="price">{fmtMoney(p.price)}</div>
          {p.description && <p style={{ margin: 0, lineHeight: 1.65 }}>{p.description}</p>}

          <div className="card pad stack" style={{ gap: 10 }}>
            <h3>Availability</h3>
            <StatusControl product={p} reservation={r} onChange={load} />
            {r && (
              <div className="small muted">
                {r.status === 'reserved' ? 'Reserved' : 'Held'} by <b style={{ color: 'var(--text)' }}>{r.person?.full_name}</b> on {fmtDateTime(r.reserved_at)}
                {r.deadline && <> · until <b style={{ color: 'var(--text)' }}>{fmtDateTime(r.deadline)}</b> ({relative(r.deadline)})</>}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Product details</h3>
            <table className="spec"><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}</tbody></table>
          </div>

          <div className="row">
            <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} />Edit</button>
            {isAdmin && <button className="btn danger" onClick={remove}><Trash2 size={15} />Delete</button>}
            <DamageButton product={p} onChange={load} />
          </div>
        </div>
      </div>

      {editing && <ProductForm product={p} categories={d.categories} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
    </>
  )
}
