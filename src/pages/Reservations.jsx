import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { Loading, StatusBadge, Thumb } from '../components/ui'
import SearchButton, { useRecordHighlight } from '../components/SearchButton'
import { fmtDateTime, isOverdue, relative } from '../lib/format'

const WEEK = 7 * 864e5

export default function Reservations() {
  const { user, isAdmin } = useAuth()
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('active')
  const [busy, setBusy] = useState(null)
  const [hit, highlight] = useRecordHighlight()

  async function load() {
    const { data } = await supabase
      .from('reservations')
      .select('*, product:products(id,name,image_url,status,category:categories(name)), person:profiles(full_name), kit:kits(id,name)')
      .order('reserved_at', { ascending: false })
      .limit(500)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function release(r) {
    setBusy(r.id)
    const { error } = await supabase.rpc('set_product_status', { p_product: r.product_id, p_status: 'available' })
    setBusy(null)
    if (error) alert(error.message)
    load()
  }

  if (!rows) return <Loading />
  const active = rows.filter((r) => r.active)
  const byDeadline = (a, b) => (a.deadline ? new Date(a.deadline) : Infinity) - (b.deadline ? new Date(b.deadline) : Infinity)
  const lists = {
    active: [...active].sort(byDeadline),
    mine: active.filter((r) => r.user_id === user.id).sort(byDeadline),
    history: rows.filter((r) => !r.active),
  }
  const shown = lists[tab]
  const summary = [
    ['Reserved', active.filter((r) => r.status === 'reserved').length, 'reserved'],
    ['On hold', active.filter((r) => r.status === 'hold').length, 'hold'],
    ['Past deadline', active.filter((r) => isOverdue(r.deadline)).length, 'overdue'],
    ['Free within 7 days', active.filter((r) => r.deadline && !isOverdue(r.deadline) && new Date(r.deadline) - Date.now() < WEEK).length, 'available'],
  ]

  const canRelease = (r) => r.active && (isAdmin || r.user_id === user.id)
  const statusCell = (r) =>
    !r.active ? <span className="badge neutral">Released</span>
      : isOverdue(r.deadline) ? <span className="badge overdue">Past deadline</span>
      : <StatusBadge status={r.status} />
  const when = (r) => r.deadline
    ? <><div>{fmtDateTime(r.deadline)}</div>{r.active && <div className="small" style={{ color: isOverdue(r.deadline) ? 'var(--bad)' : 'var(--muted)' }}>{relative(r.deadline)}</div>}</>
    : <span className="muted">No deadline</span>

  return (
    <>
      <div className="page-head">
        <div><h1>Reservations</h1><p>Who has what, and when it becomes available again.</p></div>
        <div className="spacer" />
        <SearchButton
          placeholder="Search reserved products, people, kits"
          items={rows.map((r) => ({
            key: r.id,
            title: r.product?.name || 'Item',
            subtitle: `${r.active ? (r.status === 'reserved' ? 'Reserved' : 'On hold') : 'Released'} · ${r.person?.full_name || ''} · ${fmtDateTime(r.reserved_at)}`,
            image: r.product?.image_url,
            text: `${r.product?.name || ''} ${r.product?.category?.name || ''} ${r.person?.full_name || ''} ${r.kit?.name || ''} ${r.status} ${r.active ? 'active' : 'released history'}`,
            onSelect: () => { setTab(r.active ? 'active' : 'history'); highlight(r.id) },
          }))}
        />
      </div>

      <div className="stats">
        {summary.map(([label, n, cls]) => (
          <div key={label} className="card stat">
            <div className="lbl"><span className={`badge ${cls}`}>{label}</span></div>
            <div className="val">{n}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[['active', `All active (${lists.active.length})`], ['mine', `Mine (${lists.mine.length})`], ['history', 'History']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {shown.length === 0 ? <div className="card empty">Nothing here.</div> : (
        <>
          <div className="card table-wrap collapse">
            <table className="table">
              <thead><tr><th>Item</th><th>Status</th><th>Reserved by</th><th>Reserved on</th><th>Deadline / available again</th><th></th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} data-record={r.id} className={hit === r.id ? 'search-hit' : undefined}>
                    <td>
                      <div className="row">
                        <Thumb src={r.product?.image_url} />
                        <div>
                          <Link to={`/product/${r.product_id}`} style={{ fontWeight: 600 }}>{r.product?.name}</Link>
                          <div className="small muted">{r.product?.category?.name || 'Unassigned'}{r.kit && <> · Kit: <Link to={`/kits/${r.kit.id}`}>{r.kit.name}</Link></>}</div>
                        </div>
                      </div>
                    </td>
                    <td>{statusCell(r)}</td>
                    <td>{r.person?.full_name}</td>
                    <td>{fmtDateTime(r.reserved_at)}</td>
                    <td>{when(r)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {canRelease(r) && <button className="btn sm" disabled={busy === r.id} onClick={() => release(r)}>Release</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rcards">
            {shown.map((r) => (
              <div key={r.id} data-record={r.id} className={`card rcard ${hit === r.id ? 'search-hit' : ''}`}>
                <Thumb src={r.product?.image_url} lg />
                <div className="grow">
                  <div className="row"><Link to={`/product/${r.product_id}`} style={{ fontWeight: 600 }}>{r.product?.name}</Link><div className="spacer" />{statusCell(r)}</div>
                  <div className="small muted">By {r.person?.full_name} · {fmtDateTime(r.reserved_at)}</div>
                  <div className="small">Deadline: {r.deadline ? `${fmtDateTime(r.deadline)}${r.active ? ` (${relative(r.deadline)})` : ''}` : 'none'}</div>
                  {canRelease(r) && <div><button className="btn sm" disabled={busy === r.id} onClick={() => release(r)}>Release</button></div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
