# Inventory

Agency inventory platform — React (Vite) + Supabase.

## Setup

1. Create a project at https://supabase.com.
2. Supabase → **SQL Editor** → paste `supabase/schema.sql` → **Run**.
3. Copy `.env.example` to `.env` and fill in the Project URL and `anon` public key (Project Settings → API).
4. `npm install` then `npm run dev` and open http://localhost:5173.
5. Sign up. **The first account becomes Admin**; later sign-ups are Users. Admins can change roles in Settings.

Tip: for quick testing, turn off "Confirm email" in Supabase → Authentication → Providers → Email.

## Roles (enforced in the database with Row Level Security)

| | Admin | User |
|---|---|---|
| View all pages & products | ✓ | ✓ |
| Add / edit / delete products & categories, CSV upload | ✓ | — |
| Set Available / Hold / Reserve | any item | free items or their own holds |
| Kits | manage all | create & manage their own |
| Rent entries | manage all | add & manage their own |
| Upcoming events, user roles | ✓ | — |

Status changes go through the `set_product_status` database function, so a User can't override someone else's reservation even by calling the API directly.

## CSV import

`sample-products.csv` shows the format. Recognised columns: name, category, price, image (link/url), description — any other column is stored as a product detail. Category names are matched case-insensitively and by plural/synonym ("camera" → existing "Cameras"). Rows with no category are auto-detected from name/description when only one category clearly fits; otherwise you pick one in the preview before importing.
