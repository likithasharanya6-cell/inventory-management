import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../auth'
import { applyTheme, getTheme } from '../lib/theme'

export default function Settings() {
  const { user, isAdmin } = useAuth()
  const [theme, setTheme] = useState(getTheme())
  const [users, setUsers] = useState([])

  const loadUsers = () => supabase.from('profiles').select('*').order('created_at').then(({ data }) => setUsers(data || []))
  useEffect(() => { if (isAdmin) loadUsers() }, [isAdmin])

  function pick(t) {
    setTheme(t)
    applyTheme(t)
  }
  async function setRole(id, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) alert(error.message)
    loadUsers()
  }

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1></div></div>
      <div className="stack">
        <div className="card pad stack">
          <h2>Appearance</h2>
          <div className="row wrap" style={{ gap: 14 }}>
            {['light', 'dark'].map((t) => (
              <button key={t} className={`theme-opt ${theme === t ? 'on' : ''}`} onClick={() => pick(t)}>
                <div className={`theme-prev ${t}`}><i /><u /></div>
                <b>{t === 'light' ? 'Light theme' : 'Dark theme'}</b>
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="card">
            <div className="panel-head"><h2>User roles</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <select className="input" style={{ width: 120 }} value={u.role} disabled={u.id === user.id} onChange={(e) => setRole(u.id, e.target.value)}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
