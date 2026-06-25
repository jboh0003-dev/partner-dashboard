# Partner Dashboard Starter

오케스트로 파트너사 관리를 위한 Next.js + Supabase 기본 프로젝트입니다.

## 1. 설치

```bash
npm install
npm run dev
```

브라우저에서 아래 주소로 접속합니다.

```bash
http://localhost:3000
```

## 2. Supabase 설정

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=Supabase anon public key
SUPABASE_SERVICE_ROLE_KEY=Supabase service role key
```

주의:
- `NEXT_PUBLIC_` 값은 브라우저에 노출되는 공개 키입니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용해야 합니다.
- 절대 화면 컴포넌트에 직접 넣지 마세요.

## 3. DB 생성

Supabase SQL Editor에서 아래 파일 내용을 실행하세요.

```bash
supabase/migrations/001_init.sql
```

## 4. 현재 구현된 화면

- `/login` 로그인
- `/dashboard` 대시보드 홈
- `/dashboard/partners` 파트너 목록
- `/dashboard/partners/new` 파트너 신규 등록
- `/dashboard/partners/[id]` 파트너 상세
- `/dashboard/upload` 엑셀 업로드 미리보기
- `/dashboard/trainings` 교육 관리 기본 화면
- `/dashboard/events` 행사 관리 기본 화면
- `/dashboard/assets` 장비 관리 기본 화면

## 5. 개발 우선순위

1. Supabase 테이블 생성
2. 로그인 테스트
3. 파트너 목록 조회
4. 파트너 상세 조회
5. 파트너 신규 등록/수정
6. 엑셀 업로드 저장
7. 교육/행사/장비 이력 연결
