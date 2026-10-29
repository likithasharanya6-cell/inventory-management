-- Let every signed-in user (not just Admins) use the Categories page tools:
-- Add product, Upload image, Upload CSV and Manage categories.
-- Run once in Supabase → SQL Editor (after schema.sql and storage.sql).
-- Deleting products stays Admin-only.

-- Manage categories: add, rename, delete
create policy "users manage categories" on public.categories for all to authenticated
  using (true) with check (true);

-- Add product / Upload image / Upload CSV (CSV re-uploads update products with the same name)
create policy "users add products" on public.products for insert to authenticated
  with check (true);
create policy "users update products" on public.products for update to authenticated
  using (true) with check (true);

-- Upload image / product photo uploads
create policy "users upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
