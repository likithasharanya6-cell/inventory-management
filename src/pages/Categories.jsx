import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, FolderCog, LayoutGrid, Plus, Search, SlidersHorizontal, Upload } from 'lucide-react'
import { loadCatalog } from '../lib/data'
import ProductCard from '../components/ProductCard'
import ProductForm from '../components/ProductForm'
import CsvImport from '../components/CsvImport'
import CategoryManager from '../components/CategoryManager'
import ImageIdentify from '../components/ImageIdentify'
import SearchButton from '../components/SearchButton'
import { Img, Loading } from '../components/ui'

const STATUSES = [['available', 'Available'], ['hold', 'On hold'], ['reserved', 'Reserved']]

export default function Categories() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [statuses, setStatuses] = useState([])
  const [sort, setSort] = useState('name')
  const [modal, setModal] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const cat = params.get('cat') || 'all'

  const load = () => loadCatalog().then(setData)
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const m = {}
    for (const p of data?.products || []) m[p.category_id || 'unassigned'] = (m[p.category_id || 'unassigned'] || 0) + 1
    return m
  }, [data])

  if (!data) return <Loading />
  const catName = Object.fromEntries(data.categories.map((c) => [c.id, c.name]))
  const coverOf = (id) => data.products.find((p) => p.category_id === id && p.image_url)?.image_url
  const current = cat === 'all' ? 'All products' : cat === 'unassigned' ? 'Unassigned' : catName[cat] || 'Category'

  const s = q.trim().toLowerCase()
  const shown = data.products
    .filter((p) => cat === 'all' || (cat === 'unassigned' ? !p.category_id : p.category_id === cat))
    .filter((p) => !statuses.length || statuses.includes(p.status))
    .filter((p) => !s || `${p.name} ${p.description || ''}`.toLowerCase().includes(s))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'price-asc' ? (a.price ?? 0) - (b.price ?? 0) : (b.price ?? 0) - (a.price ?? 0)))

  const choose = (id) => setParams(id === 'all' ? {} : { cat: id })
  const toggleStatus = (st) => setStatuses(statuses.includes(st) ? statuses.filter((x) => x !== st) : [...statuses, st])
  const done = (msg) => { setModal(null); setNotice(msg || ''); load() }

  return (
    <>
      <div className="crumbs">Inventory / Categories{cat !== 'all' && <> / <b>{current}</b></>}</div>
      <div className="page-head">
        <div><h1>{current} <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>- {shown.length} items</span></h1></div>
        <div className="spacer" />
        <div className="row wrap">
          <SearchButton
            placeholder="Search all products"
            items={data.products.map((p) => ({
              key: p.id,
              title: p.name,
              subtitle: catName[p.category_id] || 'Unassigned',
              image: p.image_url,
              text: `${p.name} ${p.description || ''} ${catName[p.category_id] || ''}`,
              onSelect: () => navigate(`/product/${p.id}`),
            }))}
          />
          <button className="btn" onClick={() => setModal('cats')}><FolderCog size={16} />Manage categories</button>
          <button className="btn" onClick={() => setModal('csv')}><Upload size={16} />Upload CSV</button>
          <button className="btn" onClick={() => setModal('photo')}><Camera size={16} />Upload image</button>
          <button className="btn primary" onClick={() => setModal('add')}><Plus size={16} />Add product</button>
        </div>
      </div>
      {notice && <div className="notice" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="cat-strip">
        <button className={`cat-tile ${cat === 'all' ? 'on' : ''}`} onClick={() => choose('all')}>
          <div className="circle"><LayoutGrid size={30} color="var(--olive)" /></div>
          <div className="label">All</div><div className="count">{data.products.length}</div>
        </button>
        {data.categories.map((c) => (
          <button key={c.id} className={`cat-tile ${cat === c.id ? 'on' : ''}`} onClick={() => choose(c.id)}>
            <div className="circle"><Img src={coverOf(c.id)} size={26} /></div>
            <div className="label">{c.name}</div><div className="count">{counts[c.id] || 0}</div>
          </button>
        ))}
        {counts.unassigned > 0 && (
          <button className={`cat-tile ${cat === 'unassigned' ? 'on' : ''}`} onClick={() => choose('unassigned')}>
            <div className="circle"><Img size={26} /></div>
            <div className="label">Unassigned</div><div className="count">{counts.unassigned}</div>
          </button>
        )}
      </div>

      <div className="browse">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`}>
          <h4>Categories</h4>
          <label><input type="radio" checked={cat === 'all'} onChange={() => choose('all')} />All<span className="count">{data.products.length}</span></label>
          {data.categories.map((c) => (
            <label key={c.id}><input type="radio" checked={cat === c.id} onChange={() => choose(c.id)} />{c.name}<span className="count">{counts[c.id] || 0}</span></label>
          ))}
          {counts.unassigned > 0 && (
            <label><input type="radio" checked={cat === 'unassigned'} onChange={() => choose('unassigned')} />Unassigned<span className="count">{counts.unassigned}</span></label>
          )}
          <h4>Availability</h4>
          {STATUSES.map(([st, label]) => (
            <label key={st}><input type="checkbox" checked={statuses.includes(st)} onChange={() => toggleStatus(st)} />{label}</label>
          ))}
        </aside>

        <div>
          <div className="toolbar">
            <div className="search"><Search size={16} /><input className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} />Filters</button>
            <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Sort: Name</option>
              <option value="price-asc">Price: Low to high</option>
              <option value="price-desc">Price: High to low</option>
            </select>
          </div>
          {shown.length === 0 ? (
            <div className="card empty">{data.products.length ? 'No products match.' : 'No products yet — upload a CSV or add one.'}</div>
          ) : (
            <div className="product-grid">
              {shown.map((p) => <ProductCard key={p.id} product={p} category={cat === 'all' ? catName[p.category_id] : null} />)}
            </div>
          )}
        </div>
      </div>

      {modal === 'add' && <ProductForm categories={data.categories} defaultCategory={catName[cat] ? cat : ''} onClose={() => setModal(null)} onSaved={() => done('Product added.')} />}
      {modal === 'photo' && <ImageIdentify categories={data.categories} onClose={() => setModal(null)} onSaved={() => done('Product added.')} />}
      {modal === 'csv' && <CsvImport categories={data.categories} onClose={() => setModal(null)} onDone={(added, updated) => done(`Imported ${added} new product(s)${updated ? `, updated ${updated} existing` : ''}.`)} />}
      {modal === 'cats' && <CategoryManager categories={data.categories} counts={counts} onClose={() => setModal(null)} onChanged={load} />}
    </>
  )
}
