-- Inventory platform schema for Supabase.
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- The FIRST account that signs up becomes Admin automatically; everyone after is a User.

create extension if not exists citext;

-- ───────────── Profiles & roles ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'user' else 'admin' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Inventory ─────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,          -- case-insensitive unique → no duplicate categories
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories on delete set null,
  price numeric(12, 2),
  image_url text,
  description text,
  details jsonb not null default '{}'::jsonb,   -- any extra CSV columns
  status text not null default 'available' check (status in ('available', 'hold', 'reserved')),
  damaged boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.kit_items (
  kit_id uuid not null references public.kits on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  primary key (kit_id, product_id)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  status text not null check (status in ('hold', 'reserved')),
  reserved_at timestamptz not null default now(),
  deadline timestamptz,
  kit_id uuid references public.kits on delete set null,
  active boolean not null default true,
  released_at timestamptz
);
create unique index if not exists one_active_reservation on public.reservations (product_id) where active;

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null,
  description text,
  image_url text,
  source text,
  return_deadline timestamptz not null,
  cost numeric(12, 2),
  returned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text,
  created_by uuid default auth.uid() references public.profiles on delete set null
);

-- ───────────── Status changes (Available / Hold / Reserve) ─────────────
-- Users can't update products directly; they go through this function, which
-- only lets them change items that are free or that they hold/reserved themselves.
create or replace function public.set_product_status(
  p_product uuid, p_status text, p_deadline timestamptz default null, p_kit uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  cur public.reservations;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_status not in ('available', 'hold', 'reserved') then raise exception 'Invalid status'; end if;
  if p_status = 'reserved' and p_deadline is null then raise exception 'A reservation deadline is required'; end if;

  select * into cur from public.reservations where product_id = p_product and active for update;
  if cur.id is not null and cur.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'This item is already held or reserved by someone else';
  end if;
  if cur.id is not null then
    update public.reservations set active = false, released_at = now() where id = cur.id;
  end if;

  if p_status <> 'available' then
    insert into public.reservations (product_id, user_id, status, deadline, kit_id)
    values (p_product, auth.uid(), p_status, p_deadline, p_kit);
  end if;
  update public.products set status = p_status where id = p_product;
end;
$$;

-- ───────────── Row Level Security ─────────────
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.products     enable row level security;
alter table public.kits         enable row level security;
alter table public.kit_items    enable row level security;
alter table public.reservations enable row level security;
alter table public.rentals      enable row level security;
alter table public.events       enable row level security;

-- Everyone signed in can view everything
create policy "read profiles"     on public.profiles     for select to authenticated using (true);
create policy "read categories"   on public.categories   for select to authenticated using (true);
create policy "read products"     on public.products     for select to authenticated using (true);
create policy "read kits"         on public.kits         for select to authenticated using (true);
create policy "read kit items"    on public.kit_items    for select to authenticated using (true);
create policy "read reservations" on public.reservations for select to authenticated using (true);
create policy "read rentals"      on public.rentals      for select to authenticated using (true);
create policy "read events"       on public.events       for select to authenticated using (true);

-- Admin-only writes
create policy "admin profiles"     on public.profiles     for update to authenticated using (public.is_admin());
create policy "admin categories"   on public.categories   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin products"     on public.products     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin reservations" on public.reservations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin events"       on public.events       for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Kits: anyone creates their own; owner or admin manages
create policy "create own kit" on public.kits for insert to authenticated with check (owner_id = auth.uid());
create policy "manage own kit" on public.kits for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "delete own kit" on public.kits for delete to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "add kit items" on public.kit_items for insert to authenticated with check (
  exists (select 1 from public.kits k where k.id = kit_id and (k.owner_id = auth.uid() or public.is_admin())));
create policy "remove kit items" on public.kit_items for delete to authenticated using (
  exists (select 1 from public.kits k where k.id = kit_id and (k.owner_id = auth.uid() or public.is_admin())));

-- Rentals: anyone adds their own; owner or admin manages
create policy "create own rental" on public.rentals for insert to authenticated with check (owner_id = auth.uid());
create policy "manage own rental" on public.rentals for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "delete own rental" on public.rentals for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

grant execute on function public.set_product_status(uuid, text, timestamptz, uuid) to authenticated;
