import { useState } from 'react'
import { AlertTriangle, Wrench } from 'lucide-react'
import { supabase } from '../supabase'
import { Field, Modal } from './ui'

// "Damaged" toggle for a product or a rented item. First click marks it damaged; clicking again
// asks for the resolution reason, then clears the damage (products go back to Available).
// Every change is recorded in damage_log.
export default function DamageButton({ product, rental, onChange, small }) {
  const item = product || rental
  const table = product ? 'products' : 'rentals'
  const [resolving, setResolving] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const log = (action, why) => supabase.from('damage_log').insert({
    action,
    reason: why || null,
    product_id: product?.id ?? null,
    rental_id: rental?.id ?? null,
  })

  async function markDamaged() {
    setBusy(true)
    const { error } = await supabase.from(table).update({ damaged: true }).eq('id', item.id)
    if (!error) await log('damaged')
    setBusy(false)
    if (error) return alert(error.message)
    onChange?.()
  }

  async function resolve() {
    if (!reason.trim()) return setError('Please enter how the damage was resolved')
    setBusy(true)
    setError('')
    let { error } = await supabase.from(table).update({ damaged: false }).eq('id', item.id)
    // A repaired product is available again: release any hold/reservation on it.
    if (!error && product) ({ error } = await supabase.rpc('set_product_status', { p_product: product.id, p_status: 'available' }))
    if (!error) ({ error } = await log('resolved', reason.trim()))
    setBusy(false)
    if (error) return setError(error.message)
    setResolving(false)
    setReason('')
    onChange?.()
  }

  return (
    <>
      <button
        className={`btn ${small ? 'sm' : ''} ${item.damaged ? 'danger' : ''}`}
        disabled={busy}
        title={item.damaged ? 'Damaged — click to mark as repaired' : 'Mark as damaged'}
        onClick={() => (item.damaged ? setResolving(true) : markDamaged())}
      >
        {item.damaged ? <Wrench size={15} /> : <AlertTriangle size={15} />}
Damaged
      </button>
      {resolving && (
        <Modal
          title={`Resolve damage — ${item.name}`}
          onClose={() => setResolving(false)}
          footer={<>
            <button className="btn" onClick={() => setResolving(false)}>Cancel</button>
            <button className="btn primary" disabled={busy} onClick={resolve}>{busy ? 'Saving…' : 'Save and mark available'}</button>
          </>}
        >
          <Field label="Resolution reason *">
            <textarea className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Lens mount repaired by service centre" />
          </Field>
          {product && <div className="small muted">The item will be set to Available.</div>}
          {error && <div className="error">{error}</div>}
        </Modal>
      )}
    </>
  )
}
