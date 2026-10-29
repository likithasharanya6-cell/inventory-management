import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Img, StatusBadge } from './ui'

// Browse every category and tick products (used when building kits).
export default function ProductPicker({ categories, products, selected, onToggle }) {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const shown = products
    .filter((p) => cat === 'all' || p.category_id === cat)
    .filter((p) => !s || p.name.toLowerCase().includes(s))

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="toolbar" style={{ margin: 0 }}>
        <div className="search"><Search size={16} /><input className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="muted small">{selected.size} selected</span>
      </div>
      <div className="chips">
        <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            {c.name} ({products.filter((p) => p.category_id === c.id).length})
          </button>
        ))}
      </div>
      {shown.length === 0 && <div className="empty">No products.</div>}
      <div className="pick-grid">
        {shown.map((p) => {
          const on = selected.has(p.id)
          return (
            <div key={p.id} className={`pick ${on ? 'on' : ''}`} onClick={() => onToggle(p.id)}>
              <div className="check">{on && <Check size={14} />}</div>
              <div className="img-box"><Img src={p.image_url} size={28} /><StatusBadge status={p.status} /></div>
              <div className="meta" title={p.name}>{p.name}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
