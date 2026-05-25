# Restaurant Auth Stability

Restaurant owner authentication uses Supabase Auth as the only login source of truth.
The `restaurant_users.password_hash` column is retained only for audit and legacy
compatibility. Login must never compare it before Supabase Auth.

## Required Environment Variables

Render backend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Vercel frontend:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` must never be configured with a `NEXT_PUBLIC_` prefix.

## Runtime Behavior

- Restaurant signup creates a confirmed Supabase Auth user first with the exact
  owner email and password, then stores the returned auth user id in
  `restaurant_users.supabase_user_id`.
- Restaurant login calls `supabase.auth.signInWithPassword()` first. If Supabase
  succeeds, the owner is authenticated and the database profile is hydrated.
- Password reset uses the server-side admin client and updates Supabase Auth
  before updating the compatibility hash.
- Backend startup validates the required Supabase env vars and runs a safe repair
  pass for existing restaurant owners. The repair confirms old unconfirmed users,
  restores missing `supabase_user_id` links, and recreates missing auth users with
  a secure temporary password so owners can recover through reset.
- No default restaurant credentials or fallback restaurant emails should exist in
  production paths.
