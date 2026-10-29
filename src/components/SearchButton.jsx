import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Thumb } from './ui'

// For results shown on the same page: highlight(id) marks the record (elements with
// data-record={id}), scrolls the visible one into view, and clears the mark after a few seconds.
export function useRecordHighlight() {
  const [hit, setHit] = useState(null)
  useEffect(() => {
    if (!hit) return
    const el = [...document.querySelectorAll(`[data-record="${hit}"]`)].find((e) => e.offsetParent)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHit(null), 3000)
    return () => clearTimeout(t)
  }, [hit])
  return [hit, setHit]
}

// Search icon that opens a search bar with instant results.
// items: [{ key, title, subtitle, image, text, onSelect }] — `text` is what the query matches.
// Results come from the page's loaded data, so they follow it whenever it changes.
export default function SearchButton({ items, placeholder = 'Search' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const results = terms.length
    ? items.filter((it) => { const t = it.text.toLowerCase(); return terms.every((w) => t.includes(w)) }).slice(0, 40)
    : []

  function pick(it) {
    setOpen(false)
    setQ('')
    it.onSelect()
  }

  return (
    <div className="search-pop" ref={box}>
      <button className="btn icon" title="Search" aria-label="Search" onClick={() => setOpen(!open)}><Search size={17} /></button>
      {open && (
        <div className="card search-panel">
          <div className="search-input">
            <Search size={16} />
            <input
              className="input"
              autoFocus
              placeholder={placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]) }}
            />
            {q && <button className="btn ghost icon sm" aria-label="Clear" onClick={() => setQ('')}><X size={14} /></button>}
          </div>
          {terms.length > 0 && (
            <div className="search-results">
              {results.length === 0 && <div className="empty" style={{ padding: 20 }}>No results found</div>}
              {results.map((it) => (
                <button key={it.key} className="search-result" onClick={() => pick(it)}>
                  <Thumb src={it.image} />
                  <span className="grow">
                    <span className="t">{it.title}</span>
                    {it.subtitle && <span className="small muted">{it.subtitle}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
