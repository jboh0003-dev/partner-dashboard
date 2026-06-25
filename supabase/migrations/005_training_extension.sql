-- 교육 회차/참석자 상세 확장 (정기·상위등급·제품·심화·기타 + 평가 필드)
-- trainings.training_type 은 001_init.sql 에 이미 존재

alter table public.trainings
  add column if not exists training_level text,
  add column if not exists product text,
  add column if not exists session_name text;

alter table public.training_attendance
  add column if not exists completion_status text,
  add column if not exists note text;

-- score, evaluation_result 는 001_init.sql 에 이미 존재

update public.trainings
set product = product_name
where product is null
  and product_name is not null;

update public.trainings
set session_name = training_name
where session_name is null
  and training_name is not null;

update public.training_attendance
set note = evaluation_memo
where note is null
  and evaluation_memo is not null;

create index if not exists trainings_type_idx
  on public.trainings (training_type);

create index if not exists trainings_level_idx
  on public.trainings (training_level);

create index if not exists trainings_year_month_idx
  on public.trainings (training_year, training_month);
