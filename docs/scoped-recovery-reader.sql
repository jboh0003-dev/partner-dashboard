-- Review-only setup: apply only after owner approval. Password is set separately as a generated secret.
-- Only these 27 Connect tables are readable; no Work Hub tables, auth.users grants, writes, or role membership.
create role connect_recovery_reader login nosuperuser nocreatedb nocreaterole noinherit bypassrls connection limit 8;
alter role connect_recovery_reader set default_transaction_read_only=on;
alter role connect_recovery_reader set statement_timeout='15s';
grant connect on database postgres to connect_recovery_reader;
grant usage on schema public to connect_recovery_reader;
grant select on public.partners, public.partner_contacts, public.contact_roles, public.contact_emails, public.contact_phones, public.partner_aliases, public.partner_assets, public.partner_documents, public.partner_notes, public.partner_knowledge, public.partner_grade_history, public.partner_revenue_records, public.partner_performance_snapshots, public.partner_pipeline_opportunities, public.platinum_partner_reports, public.profiles, public.trainings, public.training_attendance, public.training_registrations, public.events, public.event_attendance, public.partner_events, public.partner_event_partners, public.partner_event_documents, public.partner_event_curation_items, public.partner_policy_documents, public.partner_policy_chunks to connect_recovery_reader;
create schema connect_recovery_private;
revoke all on schema connect_recovery_private from public,anon,authenticated;
grant usage on schema connect_recovery_private to connect_recovery_reader;
create function connect_recovery_private.authenticate(account_email text, account_password text)
returns table(id uuid,email text,role text) language sql security definer set search_path='' as $function$
 select u.id,u.email::text,coalesce(p.role,'viewer')::text
 from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email)=lower(trim(account_email))
 and u.encrypted_password=extensions.crypt(account_password,u.encrypted_password)
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) limit 1
$function$;
revoke all on function connect_recovery_private.authenticate(text,text) from public,anon,authenticated;
grant execute on function connect_recovery_private.authenticate(text,text) to connect_recovery_reader;