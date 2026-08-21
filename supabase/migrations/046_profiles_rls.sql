-- profiles: authenticated can read own row only.
-- Writes (insert/update/delete), including role, go through service role (account APIs).
-- Idempotent. Does not change existing profile rows.

alter table public.profiles enable row level security;

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles delete own" on public.profiles;
drop policy if exists "profiles read own" on public.profiles;

create policy "profiles read own"
on public.profiles for select
to authenticated
using (id = auth.uid());
