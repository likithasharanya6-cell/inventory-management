import { useState } from 'react'
import Papa from 'papaparse'
import { Upload } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal, Thumb } from './ui'
import { canonicalCategory, detectCategory } from '../lib/categorize'
import { fmtMoney } from '../lib/format'

// Header aliases → field, compared without case, spaces or punctuation ("imageUrl" = "Image URL" = "image_url").
// Any other column is kept in `details`.
const ALIASES = {
  name: ['name', 'productname', 'product', 'title', 'item', 'itemname'],
  category: ['category', 'categories', 'type', 'producttype', 'group', 'categoryname'],
  price: ['price', 'cost', 'rate', 'mrp', 'amount', 'value', 'valuation', 'priceinr'],
  image_url: ['image', 'imageurl', 'imagelink', 'img', 'imgurl', 'photo', 'photourl', 'picture', 'thumbnail', 'imagesrc'],
  description: ['description', 'desc', 'details', 'about', 'productdescription'],
}
const squash = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
const fieldOf = (header) => Object.keys(ALIASES).find((f) => ALIASES[f].includes(squash(header)))
const parsePrice = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

export default function CsvImport({ categories, onClose, onDone }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const existing = categories.map((c) => c.name)

  function onFile(file) {
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const map = Object.fromEntries(meta.fields.map((h) => [h, fieldOf(h)]))
        if (!Object.values(map).includes('name')) return setError('Could not find a product name column (e.g. "name").')
        const known = [...existing]
        const parsed = data.map((raw, i) => {
          const r = { key: i, details: {} }
          for (const [h, v] of Object.entries(raw)) {
            const val = String(v ?? '').trim()
            if (map[h]) r[map[h]] = val
            else if (val) r.details[h.trim()] = val
          }
          let category = canonicalCategory(r.category, known)
          r.source = category ? 'csv' : null
          if (!category) {
            category = detectCategory(`${r.name} ${r.description || ''}`, known)
            if (category) r.source = 'auto'
          }
          if (category && !known.includes(category)) known.push(category)
          r.category = category || ''
          r.price = parsePrice(r.price)
          return r
        }).filter((r) => r.name)
        setRows(parsed)
      },
      error: (e) => setError(e.message),
    })
  }

  const allCats = [...new Set([...existing, ...(rows || []).map((r) => r.category).filter(Boolean)])].sort()
  const missing = (rows || []).filter((r) => !r.category).length
  const counts = (rows || []).reduce((m, r) => ({ ...m, [r.category || 'Unassigned']: (m[r.category || 'Unassigned'] || 0) + 1 }), {})

  function setCategory(key, value) {
    if (value === '__new') {
      const name = canonicalCategory(prompt('New category name') || '', allCats)
      if (!name) return
      value = name
    }
    setRows(rows.map((r) => (r.key === key ? { ...r, category: value, source: value ? 'manual' : null } : r)))
  }

  async function importAll() {
    setBusy(true)
    setError('')
    try {
      const needed = [...new Set(rows.map((r) => r.category).filter(Boolean))]
      const toCreate = needed.filter((n) => !existing.some((e) => e.toLowerCase() === n.toLowerCase()))
      if (toCreate.length) {
        const { error } = await supabase.from('categories')
          .upsert(toCreate.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
        if (error) throw error
      }
      const { data: cats, error: ce } = await supabase.from('categories').select('id,name')
      if (ce) throw ce
      const idOf = Object.fromEntries(cats.map((c) => [c.name.toLowerCase(), c.id]))
      const products = rows.map((r) => ({
        name: r.name,
        category_id: r.category ? idOf[r.category.toLowerCase()] : null,
        price: r.price,
        image_url: r.image_url || null,
        description: r.description || null,
        details: r.details,
      }))
      // Products whose name already exists are updated rather than duplicated.
      const { data: current, error: pe } = await supabase.from('products').select('id,name')
      if (pe) throw pe
      const existingId = Object.fromEntries(current.map((p) => [p.name.trim().toLowerCase(), p.id]))
      const fresh = products.filter((p) => !existingId[p.name.toLowerCase()])
      const updates = products.filter((p) => existingId[p.name.toLowerCase()])
      for (let i = 0; i < fresh.length; i += 500) {
        const { error } = await supabase.from('products').insert(fresh.slice(i, i + 500))
        if (error) throw error
      }
      for (const p of updates) {
        const { error } = await supabase.from('products').update(p).eq('id', existingId[p.name.toLowerCase()])
        if (error) throw error
      }
      onDone(fresh.length, updates.length)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title="Upload products CSV"
      onClose={onClose}
      footer={rows && <>
        <span className="muted small" style={{ marginRight: 'auto' }}>
          {missing > 0 ? `${missing} item(s) have no category yet — assign below or they'll go to Unassigned.` : 'All items have a category.'}
        </span>
        <button className="btn" onClick={() => setRows(null)}>Choose another file</button>
        <button className="btn primary" disabled={busy} onClick={importAll}>{busy ? 'Importing…' : `Import ${rows.length} products`}</button>
      </>}
    >
      {!rows && (
        <label className="card pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderStyle: 'dashed', cursor: 'pointer', padding: 40 }}>
          <Upload size={28} color="var(--olive)" />
          <b>Choose a CSV file</b>
          <span className="muted small" style={{ textAlign: 'center' }}>
            Columns like name, category, price, image link, description. Extra columns are kept as product details.
          </span>
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
        </label>
      )}
      {rows && (
        <>
          <div className="row wrap">
            {Object.entries(counts).map(([c, n]) => (
              <span key={c} className={`badge ${c === 'Unassigned' ? 'hold' : 'neutral'}`}>{c} · {n}</span>
            ))}
          </div>
          <div className="table-wrap card">
            <table className="table">
              <thead><tr><th></th><th>Product</th><th>Price</th><th>Category</th><th>Source</th></tr></thead>
              <tbody>
                {[...rows].sort((a, b) => !!a.category - !!b.category).map((r) => (
                  <tr key={r.key}>
                    <td style={{ width: 56 }}><Thumb src={r.image_url} /></td>
                    <td><div style={{ fontWeight: 600 }}>{r.name}</div><div className="small muted">{(r.description || '').slice(0, 80)}</div></td>
                    <td>{fmtMoney(r.price)}</td>
                    <td style={{ minWidth: 190 }}>
                      <select className="input" value={r.category} onChange={(e) => setCategory(r.key, e.target.value)}
                        style={!r.category ? { borderColor: 'var(--hold)' } : undefined}>
                        <option value="">— Choose —</option>
                        {allCats.map((c) => <option key={c}>{c}</option>)}
                        <option value="__new">+ New category…</option>
                      </select>
                    </td>
                    <td className="small muted">{{ csv: 'From CSV', auto: 'Detected', manual: 'Manual' }[r.source] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}
