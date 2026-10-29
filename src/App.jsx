import { Navigate, Route, Routes } from 'react-router-dom'
import { configured } from './supabase'
import { useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import ProductDetail from './pages/ProductDetail'
import Kits from './pages/Kits'
import KitDetail from './pages/KitDetail'
import Reservations from './pages/Reservations'
import Rent from './pages/Rent'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'

export default function App() {
  const { session, loading } = useAuth()

  if (!configured) {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <h2>Connect Supabase</h2>
          <p className="muted">
            Copy <code>.env.example</code> to <code>.env</code>, add your Supabase URL and anon key,
            run <code>supabase/schema.sql</code> in the SQL editor, then restart <code>npm run dev</code>.
          </p>
        </div>
      </div>
    )
  }
  if (loading) return <div className="center-screen"><div className="spinner" /></div>
  if (!session) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/kits" element={<Kits />} />
        <Route path="/kits/:id" element={<KitDetail />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/rent" element={<Rent />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}
