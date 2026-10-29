import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '../supabase'
import { Field, Img, Modal } from './ui'
import { canonicalCategory } from '../lib/categorize'

const detailsToText = (d) => Object.entries(d || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
const textToDetails = (t) =>
  Object.fromEntries(
    t.split('\n').map((l) => l.split(/:(.*)/s).map((s) => s.trim())).filter(([k, v]) => k && v)
  )

// Admin: add or edit one product. `initial` pre-fills a new product (e.g. from photo recognition).
export default function ProductForm({ product, initial, categories, defaultCategory, onClose, onSaved }) {
  const [f, setF] = useState({
    name: product?.name || initial?.name || '',
    category_id: product?.category_id || defaultCategory || '',
    newCategory: '',
    price: product?.price ?? '',
    image_url: product?.image_url || initial?.image_url || '',
    description: product?.description || initial?.description || '',
    details: detailsToText(product?.details),
    damaged: product?.damaged || false,
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function uploadImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose an image file')
    setUploading(true)
    setError('')
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type })
    setUploading(false)
    if (error) return setError(`Image upload failed: ${error.message}`)
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setF((cur) => ({ ...cur, image_url: data.publicUrl }))
  }

  async function save() {
    if (!f.name.trim()) return setError('Product name is required')
    if (!f.category_id || (f.category_id === '__new' && !f.newCategory.trim())) return setError('Category is required')
    setBusy(true)
    setError('')
    let category_id = f.category_id || null
    if (f.category_id === '__new') {
      const name = canonicalCategory(f.newCategory, categories.map((c) => c.name))
      if (!name) { setBusy(false); return setError('Enter a category name') }
      const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (existing) category_id = existing.id
      else {
        const { data, error } = await supabase.from('categories').insert({ name }).select().single()
        if (error) { setBusy(false); return setError(error.message) }
        category_id = data.id
      }
    }
    const row = {
      name: f.name.trim(),
      category_id,
      price: f.price === '' ? null : Number(f.price),
      image_url: f.image_url.trim() || null,
      description: f.description.trim() || null,
      details: textToDetails(f.details),
      damaged: f.damaged,
    }
    const { error } = product
      ? await supabase.from('products').update(row).eq('id', product.id)
      : await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal
      title={product ? 'Edit product' : 'Add product'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || uploading} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <Field label="Name *"><input className="input" required value={f.name} onChange={set('name')} /></Field>
      <div className="grid-2">
        <Field label="Category *">
          <select className="input" required value={f.category_id} onChange={set('category_id')}>
            <option value="" disabled>Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ New category…</option>
          </select>
        </Field>
        <Field label="Price (₹)"><input className="input" type="number" min="0" value={f.price} onChange={set('price')} /></Field>
      </div>
      {f.category_id === '__new' && (
        <Field label="New category name *"><input className="input" value={f.newCategory} onChange={set('newCategory')} /></Field>
      )}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field label="Image — upload a file or paste a link"><input className="input" value={f.image_url} onChange={set('image_url')} placeholder="https://…" /></Field>
        </div>
        <label className="btn" style={uploading ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
          <Upload size={16} />{uploading ? 'Uploading…' : 'Upload'}
          <input type="file" accept="image/*" hidden onChange={(e) => { uploadImage(e.target.files[0]); e.target.value = '' }} />
        </label>
        <div className="thumb lg"><Img key={f.image_url} src={f.image_url} size={20} /></div>
      </div>
      <Field label="Description"><textarea className="input" value={f.description} onChange={set('description')} /></Field>
      <Field label="Other details (one per line, key: value)">
        <textarea className="input" value={f.details} onChange={set('details')} placeholder={'Brand: Sony\nSerial no: 12345'} />
      </Field>
      <label className="row"><input type="checkbox" checked={f.damaged} onChange={set('damaged')} /> Mark as damaged</label>
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}
