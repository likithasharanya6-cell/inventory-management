-- Give every signed-in user all Admin features (delete products, manage all kits, rentals,
-- reservations and events, change user roles, ...).
-- Run once in Supabase → SQL Editor.
--
-- Every Admin permission in the database checks public.is_admin(), so this makes it true for any
-- signed-in user.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null;
$$;

-- To restore Admin-only permissions later, run this instead (the original definition):
--
-- create or replace function public.is_admin() returns boolean
-- language sql stable security definer set search_path = public as $$
--   select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
-- $$;
--
-- and in src/auth.jsx set:  isAdmin: profile?.role === 'admin'
