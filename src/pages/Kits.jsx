import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Plus } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { loadCatalog } from '../lib/data'
import ProductPicker from '../components/ProductPicker'
import SearchButton from '../components/SearchButton'
import { Field, Img, Loading, Modal } from '../components/ui'

export default function Kits() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [kits, setKits] = useState(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('kits')
      .select('*, owner:profiles(full_name), items:kit_items(product:products(id,name,image_url,status))')
      .order('created_at', { ascending: false })
    setKits(data || [])
  }
  useEffect(() => { load() }, [])

  if (!kits) return <Loading />
  return (
    <>
      <div className="page-head">
        <div><h1>Kits</h1><p>Groups of equipment commonly used together for events.</p></div>
        <div className="spacer" />
        <SearchButton
          placeholder="Search kits and their items"
          items={kits.flatMap((k) => [
            {
              key: k.id,
              title: k.name,
              subtitle: `Kit · ${k.items.length} items`,
              image: k.items.find((i) => i.product?.image_url)?.product.image_url,
              text: `${k.name} ${k.description || ''}`,
              onSelect: () => navigate(`/kits/${k.id}`),
            },
            ...k.items.map((i) => i.product).filter(Boolean).map((p) => ({
              key: `${k.id}-${p.id}`,
              title: p.name,
              subtitle: `In kit: ${k.name}`,
              image: p.image_url,
              text: `${p.name} ${k.name}`,
              onSelect: () => navigate(`/kits/${k.id}`),
            })),
          ])}
        />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />Create kit</button>
      </div>

      {kits.length === 0 && <div className="card empty">No kits yet. Create one like “Wedding Kit” or “Small Event Kit”.</div>}
      <div className="kit-grid">
        {kits.map((k) => {
          const items = k.items.map((i) => i.product).filter(Boolean)
          const free = items.filter((p) => p.status === 'available').length
          return (
            <div key={k.id} className="card kit-card" onClick={() => navigate(`/kits/${k.id}`)}>
              <div className="collage">
                {[0, 1, 2, 3].map((i) => <div key={i}>{items[i] ? <Img src={items[i].image_url} size={22} /> : i === 0 && <Package size={26} />}</div>)}
              </div>
              <div className="body">
                <h3>{k.name}</h3>
                <div className="small muted" style={{ margin: '2px 0 8px' }}>
                  by {k.owner_id === user.id ? 'you' : k.owner?.full_name} · {items.length} items
                </div>
                <div className="row wrap">
                  <span className="badge available">{free} available</span>
                  {items.length - free > 0 && <span className="badge hold">{items.length - free} held/reserved</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {creating && <KitForm onClose={() => setCreating(false)} onSaved={(id) => navigate(`/kits/${id}`)} />}
    </>
  )
}

export function KitForm({ kit, initialIds = [], onClose, onSaved }) {
  const [catalog, setCatalog] = useState(null)
  const [name, setName] = useState(kit?.name || '')
  const [description, setDescription] = useState(kit?.description || '')
  const [selected, setSelected] = useState(new Set(initialIds))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { loadCatalog().then(setCatalog) }, [])

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function save() {
    if (!name.trim()) return setError('Give the kit a name')
    setBusy(true)
    setError('')
    let id = kit?.id
    const res = kit
      ? await supabase.from('kits').update({ name: name.trim(), description: description || null }).eq('id', id)
      : await supabase.from('kits').insert({ name: name.trim(), description: description || null }).select().single()
    if (res.error) { setBusy(false); return setError(res.error.message) }
    if (!kit) id = res.data.id
    const before = new Set(initialIds)
    const add = [...selected].filter((p) => !before.has(p))
    const remove = initialIds.filter((p) => !selected.has(p))
    if (add.length) {
      const { error } = await supabase.from('kit_items').insert(add.map((product_id) => ({ kit_id: id, product_id })))
      if (error) { setBusy(false); return setError(error.message) }
    }
    if (remove.length) await supabase.from('kit_items').delete().eq('kit_id', id).in('product_id', remove)
    onSaved(id)
  }

  return (
    <Modal
      wide
      title={kit ? 'Edit kit' : 'Create kit'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : `Save kit (${selected.size} items)`}</button>
      </>}
    >
      <div className="grid-2">
        <Field label="Kit name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding Kit" /></Field>
        <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></Field>
      </div>
      {error && <div className="error">{error}</div>}
      {catalog ? <ProductPicker categories={catalog.categories} products={catalog.products} selected={selected} onToggle={toggle} /> : <Loading />}
    </Modal>
  )
}
