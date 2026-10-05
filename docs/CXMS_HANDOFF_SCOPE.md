# Partner Connect CXMS 인수 범위

이 문서는 전사 CXMS 통합 인수자료 작성 시 적용할 Partner Connect 전용 범위를 정의한다.

## 포함 범위
- Partner Connect 화면, API, 파트너/담당자/교육/장비/문서/실적/파이프라인/신청서/계약현황 추출 기능
- Partner Connect가 실제 사용하는 Supabase 프로젝트 단위 스키마·Storage·Auth·Edge Function 구조
- Partner Connect Vercel 프로젝트 단위 배포 구조와 환경변수 이름(값 제외)

## 명시적 제외 범위
- 개인용 Work Hub / BokDesk / 일계표 기능 전체
- `src/app/work-hub/**`
- `public/work-hub/**`
- `src/app/api/work-hub/**`
- `src/app/api/public/work-hub-*/**`
- `work-hub-app/**`
- `scripts/test-workhub-*.cjs`
- `src/lib/auth/work-hub-access.ts`
- Work Hub 전용 DB/RLS: `public.workhub_state` 및 관련 정책
- 개인 Vercel Team의 다른 프로젝트
- 같은 Supabase Organization의 다른 프로젝트
- 개인 계정·개인 데이터·기타 실험 프로젝트

## 인프라 전달 원칙
1. Vercel 계정 또는 Team 전체 권한은 전달하지 않는다.
2. Supabase Organization 또는 개인 계정 전체 권한은 전달하지 않는다.
3. 실제 Secret, Service Role Key, API Key 값은 전달하지 않는다.
4. 인수자료에는 Partner Connect 프로젝트에 필요한 설정 이름·구조·스키마만 기록한다.
5. 통합 담당자는 회사 소유 환경에 재구성한다.
6. 기존 개인 인프라는 회사 환경 검증 완료 전 유지한다.

## inventory / source snapshot 규칙
- 전수조사는 위 '포함 범위'에 대해서만 수행한다.
- 위 '명시적 제외 범위' 경로·DB 객체는 inventory에 넣지 않는다.
- source 스냅샷 생성 시 위 제외 경로는 반드시 제거한다.
- `.env*`, 토큰, 비밀번호, 키 값은 포함하지 않는다.
