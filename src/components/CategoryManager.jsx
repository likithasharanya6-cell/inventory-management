import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { Modal } from './ui'
import { canonicalCategory } from '../lib/categorize'

// Admin: add, rename and delete categories.
export default function CategoryManager({ categories, counts, onClose, onChanged }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function run(promise) {
    setError('')
    const { error } = await promise
    if (error) return setError(error.message.includes('duplicate') ? 'That category already exists.' : error.message)
    setName('')
    setEditing(null)
    onChanged()
  }

  function add() {
    const n = canonicalCategory(name, categories.map((c) => c.name))
    if (!n) return
    if (categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) return setError(`"${n}" already exists.`)
    run(supabase.from('categories').insert({ name: n }))
  }

  function remove(c) {
    if (!confirm(`Delete "${c.name}"? Its ${counts[c.id] || 0} product(s) will become Unassigned.`)) return
    run(supabase.from('categories').delete().eq('id', c.id))
  }

  return (
    <Modal title="Manage categories" onClose={onClose}>
      <div className="row">
        <input className="input" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn primary" onClick={add}>Add</button>
      </div>
      {error && <div className="error">{error}</div>}
      <ul className="list" style={{ padding: 0 }}>
        {categories.map((c) => (
          <li key={c.id}>
            {editing?.id === c.id ? (
              <>
                <input className="input" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <button className="btn primary sm" onClick={() => run(supabase.from('categories').update({ name: editing.name.trim() }).eq('id', c.id))}>Save</button>
                <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
              </>
            ) : (
              <>
                <div className="grow"><div className="t">{c.name}</div><div className="small muted">{counts[c.id] || 0} products</div></div>
                <button className="btn ghost icon sm" onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil size={15} /></button>
                <button className="btn ghost icon sm danger" onClick={() => remove(c)}><Trash2 size={15} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
