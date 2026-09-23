-- Preserve the existing owner's row and ownership policies. This additional
-- restrictive policy prevents other Connect accounts from using Work Hub.
do $$
begin
  if not exists (
    select 1 from auth.users
    where id = '6b290f26-391a-432f-bec9-a72c3cc8335c'
      and lower(email) = 'jb.oh@okestro.com'
  ) then
    raise exception 'Verified Work Hub owner is missing; refusing to change access';
  end if;
end $$;

alter table public.workhub_state enable row level security;
create policy workhub_owner_only on public.workhub_state
  as restrictive for all to authenticated
  using ((select auth.uid()) = '6b290f26-391a-432f-bec9-a72c3cc8335c'::uuid)
  with check ((select auth.uid()) = '6b290f26-391a-432f-bec9-a72c3cc8335c'::uuid);
