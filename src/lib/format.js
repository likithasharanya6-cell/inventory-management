const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export const fmtMoney = (v) => (v == null || v === '' ? '—' : money.format(Number(v)))
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'

// "in 3 days", "in 2 h", "5 h overdue"
export function relative(d) {
  if (!d) return ''
  const ms = new Date(d) - Date.now()
  const abs = Math.abs(ms)
  const h = abs / 36e5
  const txt = h < 1 ? `${Math.max(1, Math.round(abs / 6e4))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`
  return ms < 0 ? `${txt} overdue` : `in ${txt}`
}

export const isOverdue = (d) => d && new Date(d) < new Date()

// datetime-local input value <-> ISO
export const toLocalInput = (d) => {
  if (!d) return ''
  const x = new Date(d)
  return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16)
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)
