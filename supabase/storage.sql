-- Image uploads for products. Run once in Supabase → SQL Editor (after schema.sql).
-- Creates a public "product-images" bucket; only Admins can upload, replace or delete files.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "admin upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin update product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "admin delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
