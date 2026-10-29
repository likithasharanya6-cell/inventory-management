import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { fromLocalInput, toLocalInput } from '../lib/format'

const OPTIONS = [['available', 'Available'], ['hold', 'Hold'], ['reserved', 'Reserve']]

// Available / Hold / Reserve switch. `reservation` is the item's active reservation (if any).
export default function StatusControl({ product, reservation, kitId, onChange, size }) {
  const { user, isAdmin } = useAuth()
  const [pending, setPending] = useState(null)
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lockedByOther = reservation && reservation.user_id !== user.id && !isAdmin

  async function apply(status, dl) {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('set_product_status', {
      p_product: product.id,
      p_status: status,
      p_deadline: fromLocalInput(dl),
      p_kit: kitId || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setPending(null)
    onChange?.()
  }

  function pick(status) {
    if (status === 'available') return apply('available')
    setDeadline(toLocalInput(reservation?.deadline) || '')
    setPending(status)
  }

  return (
    <div className="stack" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
      <div className={`seg ${size === 'sm' ? 'sm' : ''}`}>
        {OPTIONS.map(([s, label]) => (
          <button
            key={s}
            className={`${s} ${(pending || product.status) === s ? 'on' : ''}`}
            disabled={busy || lockedByOther}
            onClick={() => pick(s)}
          >{label}</button>
        ))}
      </div>
      {lockedByOther && <div className="small muted">Held/reserved by another person.</div>}
      {pending && (
        <div className="row wrap">
          <input
            type="datetime-local"
            className="input"
            style={{ width: 'auto', height: 34 }}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <button
            className="btn primary sm"
            disabled={busy || (pending === 'reserved' && !deadline)}
            onClick={() => apply(pending, deadline)}
          >{pending === 'reserved' ? 'Reserve' : 'Hold'}</button>
          <button className="btn ghost sm" onClick={() => setPending(null)}>Cancel</button>
          <div className="small muted" style={{ width: '100%' }}>
            {pending === 'reserved' ? 'Reservation deadline (required)' : 'Hold until (optional)'}
          </div>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  )
}
