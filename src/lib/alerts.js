import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { fmtDateTime, relative } from './format'

const H = 36e5
// Reminder stages: a day before, a few hours before, and once overdue.
const stageOf = (ms) => (ms < 0 ? 'overdue' : ms < 3 * H ? '3h' : ms < 24 * H ? '24h' : null)

function readSeen() {
  try { return JSON.parse(localStorage.getItem('rent-alerts-seen') || '{}') } catch { return {} }
}
function writeSeen(v) {
  try { localStorage.setItem('rent-alerts-seen', JSON.stringify(v)) } catch {}
}

export const notifyRentChanged = () => window.dispatchEvent(new Event('rentals-changed'))

export function useRentAlerts() {
  const { user, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    if (!user) return
    let alive = true
    async function check() {
      let q = supabase.from('rentals').select('id,name,return_deadline,owner_id').eq('returned', false)
      if (!isAdmin) q = q.eq('owner_id', user.id)
      const { data } = await q
      if (!alive || !data) return
      const now = Date.now()
      const due = data
        .map((r) => ({ ...r, ms: new Date(r.return_deadline) - now }))
        .filter((r) => stageOf(r.ms))
        .sort((a, b) => a.ms - b.ms)
      setItems(due)

      const seen = readSeen()
      const fresh = []
      for (const r of due) {
        const stage = stageOf(r.ms)
        const key = `${r.id}:${stage}:${r.return_deadline}`
        if (seen[key]) continue
        seen[key] = 1
        const title = stage === 'overdue' ? `Overdue: ${r.name}` : `Return soon: ${r.name}`
        const body = `Due ${fmtDateTime(r.return_deadline)} (${relative(r.return_deadline)})`
        fresh.push({ id: key, title, body, overdue: stage === 'overdue' })
        if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
      }
      writeSeen(seen)
      if (fresh.length) setToasts((t) => [...t, ...fresh])
    }
    check()
    const timer = setInterval(check, 60_000)
    window.addEventListener('rentals-changed', check)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('rentals-changed', check)
    }
  }, [user?.id, isAdmin])

  return { items, toasts, dismiss: (id) => setToasts((t) => t.filter((x) => x.id !== id)) }
}
