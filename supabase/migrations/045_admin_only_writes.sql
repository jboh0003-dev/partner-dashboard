-- Write access: admin only. Read: existing authenticated SELECT policies remain.
-- Idempotent. Does not create tables or mutate rows.
-- Missing tables (e.g. partner_pocs on production) are skipped.

create or replace function public.is_profile_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

grant execute on function public.is_profile_admin() to authenticated;

create or replace function public.apply_admin_only_write_all(p_table text, p_policy text)
returns void
language plpgsql
as $$
begin
  if to_regclass(format('public.%I', p_table)) is null then
    raise notice '045 skip missing table public.%', p_table;
    return;
  end if;

  execute format('drop policy if exists %I on public.%I', p_policy, p_table);
  execute format(
    'create policy %I on public.%I for all to authenticated using (public.is_profile_admin()) with check (public.is_profile_admin())',
    p_policy,
    p_table
  );
end;
$$;

-- Core tables from 001 / training / documents / import / events.
select public.apply_admin_only_write_all('partners', 'admins manage partners');
select public.apply_admin_only_write_all('partner_contacts', 'admins manage contacts');
select public.apply_admin_only_write_all('partner_notes', 'admins manage notes');
select public.apply_admin_only_write_all('partner_documents', 'admins manage partner_documents');
select public.apply_admin_only_write_all('partner_assets', 'admins manage partner_assets');
select public.apply_admin_only_write_all('partner_training_monthly', 'admins manage partner_training_monthly');
select public.apply_admin_only_write_all('import_jobs', 'admins manage import_jobs');
select public.apply_admin_only_write_all('import_review_queue', 'admins manage import_review_queue');
select public.apply_admin_only_write_all('contact_import_staging', 'admins manage contact_import_staging');
select public.apply_admin_only_write_all('partner_change_logs', 'admins manage partner_change_logs');
select public.apply_admin_only_write_all('partner_events', 'admins manage partner_events');
select public.apply_admin_only_write_all('partner_event_documents', 'admins manage partner_event_documents');
select public.apply_admin_only_write_all('partner_event_curation_items', 'admins write partner_event_curation_items');

-- Optional / not present on current production (PoC deferred). Skip if missing.
select public.apply_admin_only_write_all('partner_pocs', 'admins manage partner_pocs');
select public.apply_admin_only_write_all('partner_document_chunks', 'admins manage partner_document_chunks');
select public.apply_admin_only_write_all('partner_search_logs', 'admins manage partner_search_logs');

do $$
begin
  if to_regclass('public.partner_event_partners') is null then
    raise notice '045 skip missing table public.partner_event_partners';
  else
    execute 'drop policy if exists "authenticated insert partner_event_partners" on public.partner_event_partners';
    execute 'drop policy if exists "authenticated delete partner_event_partners" on public.partner_event_partners';
    execute 'drop policy if exists "authenticated update partner_event_partners" on public.partner_event_partners';
    execute 'drop policy if exists "admins insert partner_event_partners" on public.partner_event_partners';
    execute 'drop policy if exists "admins delete partner_event_partners" on public.partner_event_partners';
    execute 'drop policy if exists "admins update partner_event_partners" on public.partner_event_partners';

    execute $pol$
      create policy "admins insert partner_event_partners"
      on public.partner_event_partners for insert
      to authenticated
      with check (public.is_profile_admin())
    $pol$;
    execute $pol$
      create policy "admins delete partner_event_partners"
      on public.partner_event_partners for delete
      to authenticated
      using (public.is_profile_admin())
    $pol$;
    execute $pol$
      create policy "admins update partner_event_partners"
      on public.partner_event_partners for update
      to authenticated
      using (public.is_profile_admin())
      with check (public.is_profile_admin())
    $pol$;
  end if;

  if to_regclass('public.partner_event_curation_items') is null then
    raise notice '045 skip missing table public.partner_event_curation_items';
  else
    execute 'drop policy if exists "authenticated write partner_event_curation_items" on public.partner_event_curation_items';
  end if;
end;
$$;

drop function if exists public.apply_admin_only_write_all(text, text);

notify pgrst, 'reload schema';
