import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { supabase } from '../supabase'
import { Field } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    const { data, error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      : await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name } } })
    setBusy(false)
    if (error) return setError(error.message)
    if (mode === 'signup' && !data.session) setMsg('Check your email to confirm your account, then sign in.')
  }

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark"><Boxes size={18} /></div>Inventory</div>
        <div>
          <h1>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{mode === 'signin' ? 'Sign in to manage inventory.' : 'New accounts start with the User role.'}</p>
        </div>
        {mode === 'signup' && <Field label="Full name"><input className="input" required value={f.name} onChange={set('name')} /></Field>}
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password"><input className="input" type="password" required minLength={6} value={f.password} onChange={set('password')} /></Field>
        {error && <div className="error">{error}</div>}
        {msg && <div className="notice">{msg}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
