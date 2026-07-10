# 개발 메모

## Supabase migration 생성 기준

### migration이 **필요한** 경우

- `partners`, `partner_contacts` 등 **테이블/컬럼 추가·변경·삭제**
- **인덱스**, **unique constraint**, **RLS 정책** 변경
- DB 함수, 트리거, enum 타입 변경
- 운영 DB와 로컬 스키마를 맞추기 위한 **영구적인** 스키마 변경

같은 목적의 컬럼 추가는 **하나의 migration 파일**에 묶습니다.

```sql
alter table public.partners
  add column if not exists grade_override text;
```

### migration이 **필요 없는** 경우

- 화면 UI, 버튼, 모달, 정렬/필터/스크롤 변경
- API route, 서버 로직, upsert/매칭 로직 변경
- TypeScript 타입, React 컴포넌트, CSS/Tailwind 수정
- 엑셀 파싱·업로드 미리보기·soft delete 등 **애플리케이션 로직**만 바뀌는 경우

### 운영 안정화 후

개발 초기에 쌓인 migration은 추후 **squash**하여 `001_init.sql` 등으로 정리할 예정입니다.  
squash 전까지는 **스키마 변경이 있을 때만** 새 migration을 추가합니다.

### gitignore 유지

다음은 커밋하지 않습니다.

- `scripts/output/` 및 `scripts/output/*.csv`
- `tmp/` 임시 파일
- `.env.local`, `.env*.local`

## 파트너 업로드 upsert 원칙

엑셀 재업로드 시 insert가 아니라 **기존 row 갱신**을 기본으로 합니다.

매칭 우선순위:

1. `external_no` (파트너번호)
2. `business_number` (사업자번호)
3. 정규화된 `company_name`

`partner_no` / 사업자번호가 이미 존재하면 **신규 insert 금지** (중복 의심 또는 update).

Unique index(`partner_no`, `business_number`)는 **DB 중복 정리 후** partial unique로 적용 예정입니다.
