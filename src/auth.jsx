import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) return setLoading(false)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  async function loadProfile() {
    if (!userId) return setProfile(null)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }
  useEffect(() => { loadProfile() }, [userId])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    // Every signed-in user currently has full Admin features (see supabase/all-users-admin.sql).
    // To restore Admin-only features: profile?.role === 'admin'
    isAdmin: Boolean(profile),
    loading,
    refreshProfile: loadProfile,
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
