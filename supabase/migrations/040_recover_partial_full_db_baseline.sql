-- 040: 전체DB baseline 부분 반영(119명) 복구
-- DROP / TRUNCATE / 전체 DELETE 없음.
--
-- 원인:
--   2026-07-21 01:20 UTC job(263879fc)이 저장 시작 시 전체 in_current_full_db=false 로 리셋한 뒤
--   약 119명만 true 로 되돌리고 timeout/stale 로 중단됨.
--
-- 복구 전략:
--   최신 staging(job 3f23c786, 파일 DB.xlsx ~610행)에 있는 담당자를 current baseline 으로 복원.
--   staging 이 없으면 contact_source='full_db' + last_seen >= 2026-07-09 기준으로 복원.

-- 1) 잘못된/미완료 job 상태 정리
update public.import_jobs
set
  status = 'failed',
  error_message = coalesce(
    error_message,
    'baseline 부분 반영으로 실패 처리 (early reset 후 중도 중단)'
  ),
  completed_at = coalesce(completed_at, now()),
  updated_at = now()
where id = '263879fc-f0ad-4be8-83f3-30c59933532f';

update public.import_jobs
set
  status = 'cancelled',
  error_message = coalesce(
    error_message,
    '긴급 취소: baseline 전환 전 중단 (부분 처리)'
  ),
  cancelled_at = coalesce(cancelled_at, now()),
  completed_at = coalesce(completed_at, now()),
  updated_at = now()
where id = '3f23c786-7e2c-49ea-977c-c7f6b546350e'
  and status <> 'cancelled';

-- 2) staging 기반 복원 대상 ID 임시 테이블
create temporary table if not exists tmp_baseline_restore_ids (
  contact_id uuid primary key
) on commit drop;

-- staging existing_contact_id
insert into tmp_baseline_restore_ids (contact_id)
select distinct s.existing_contact_id
from public.contact_import_staging s
where s.import_job_id = '3f23c786-7e2c-49ea-977c-c7f6b546350e'
  and s.action in ('update', 'create', 'merge')
  and s.existing_contact_id is not null
on conflict do nothing;

-- staging person_key 로 추가 매칭 (create 예정분이 이미 insert 된 경우)
insert into tmp_baseline_restore_ids (contact_id)
select distinct c.id
from public.contact_import_staging s
join public.partner_contacts c
  on c.partner_id = s.partner_id
 and lower(regexp_replace(coalesce(c.name, ''), '\s+', '', 'g'))
   = split_part(s.person_key, '|', 2)
where s.import_job_id = '3f23c786-7e2c-49ea-977c-c7f6b546350e'
  and s.action in ('update', 'create', 'merge')
  and s.person_key is not null
  and s.partner_id is not null
  and c.deleted_at is null
  and c.merged_into_contact_id is null
on conflict do nothing;

-- staging 이 비어 있으면 Jul 9 성공 baseline + 오늘 동기화분 fallback
do $$
declare
  restore_count int;
begin
  select count(*) into restore_count from tmp_baseline_restore_ids;
  if restore_count < 100 then
    insert into tmp_baseline_restore_ids (contact_id)
    select c.id
    from public.partner_contacts c
    where c.deleted_at is null
      and c.merged_into_contact_id is null
      and c.contact_source = 'full_db'
      and (
        c.last_seen_in_full_sync_at >= timestamptz '2026-07-09'
        or c.last_synced_at >= timestamptz '2026-07-21 02:00:00+00'
        or c.in_current_full_db = true
      )
    on conflict do nothing;
  end if;
end $$;

-- 3) 복원 대상을 current baseline 으로 활성화
update public.partner_contacts c
set
  in_current_full_db = true,
  is_active = true,
  contact_source = coalesce(c.contact_source, 'full_db'),
  last_seen_in_full_sync_at = coalesce(c.last_seen_in_full_sync_at, c.last_synced_at, now()),
  review_required = case
    when c.review_reason = '이전 기준 데이터에서 제외됨' then false
    else c.review_required
  end,
  review_reason = case
    when c.review_reason = '이전 기준 데이터에서 제외됨' then null
    else c.review_reason
  end
where c.id in (select contact_id from tmp_baseline_restore_ids);

-- 4) 복원 대상이 아닌 canonical contact 는 current 에서만 제외 (삭제하지 않음)
update public.partner_contacts c
set
  in_current_full_db = false,
  is_active = case
    when c.contact_source = 'full_db' then false
    else c.is_active
  end,
  review_reason = case
    when c.contact_source = 'full_db'
      and (c.review_reason is null or c.review_reason = '')
      then '이전 기준 데이터에서 제외됨'
    else c.review_reason
  end
where c.deleted_at is null
  and c.merged_into_contact_id is null
  and c.id not in (select contact_id from tmp_baseline_restore_ids)
  and c.in_current_full_db = true;

-- 5) 검증용 주석 (실행 후 확인)
-- select
--   count(*) filter (where in_current_full_db and is_active and deleted_at is null and merged_into_contact_id is null) as active_current,
--   count(*) filter (where contact_source = 'full_db' and deleted_at is null and merged_into_contact_id is null) as full_db_canonical
-- from public.partner_contacts;
