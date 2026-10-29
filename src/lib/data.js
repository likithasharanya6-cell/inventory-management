import { supabase } from '../supabase'

// Everything the browsing pages need: categories, products and active reservations by product id.
export async function loadCatalog() {
  const [c, p, r] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('reservations').select('*, person:profiles(full_name)').eq('active', true),
  ])
  const err = c.error || p.error || r.error
  if (err) throw err
  const reservations = Object.fromEntries((r.data || []).map((x) => [x.product_id, x]))
  return { categories: c.data || [], products: p.data || [], reservations }
}
