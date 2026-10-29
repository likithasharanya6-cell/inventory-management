-- Damaged item management + Calendar page. Run once in Supabase → SQL Editor.

-- Rented/borrowed items can be marked damaged too (products already have a `damaged` column).
alter table public.rentals add column if not exists damaged boolean not null default false;

-- History of items marked damaged and repaired, with the resolution reason.
create table if not exists public.damage_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products on delete cascade,
  rental_id uuid references public.rentals on delete cascade,
  action text not null check (action in ('damaged', 'resolved')),
  reason text,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  check (product_id is not null or rental_id is not null)
);
alter table public.damage_log enable row level security;
create policy "read damage log" on public.damage_log for select to authenticated using (true);
create policy "add damage log" on public.damage_log for insert to authenticated with check (user_id = auth.uid());

-- Event details for the Calendar. `event_date` stays the start date (used by the Dashboard).
alter table public.events add column if not exists start_time time;
alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists end_time time;
alter table public.events add column if not exists description text;
