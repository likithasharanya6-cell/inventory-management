import { useState } from 'react'
import { ImageOff, X } from 'lucide-react'

const LABELS = { available: 'Available', hold: 'On hold', reserved: 'Reserved' }

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABELS[status] || status}</span>
}

export function Img({ src, alt, size = 40 }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <ImageOff className="ph" size={size} strokeWidth={1.4} />
  return <img src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} />
}

export function Thumb({ src, lg }) {
  return <div className={`thumb ${lg ? 'lg' : ''}`}><Img src={src} size={18} /></div>
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="spacer" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function Loading() {
  return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
}
