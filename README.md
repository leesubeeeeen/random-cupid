# 랜덤소개팅 신청 웹사이트 💕

랜덤소개팅 행사 참가자의 정보를 수집하는 신청 웹사이트입니다. 수집된 데이터는 이후 별도의 AI 매칭 로직에 활용할 수 있도록 정규화된 구조로 Supabase(PostgreSQL)에 저장됩니다.

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- framer-motion (마이크로 애니메이션)
- Supabase (PostgreSQL, Server Actions에서만 접근)
- zod (폼 검증)

## 1. 로컬 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 2. Supabase 연결 방법

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. 프로젝트의 **SQL Editor**를 열고 [`supabase/schema.sql`](supabase/schema.sql) 파일 내용 전체를 붙여넣어 실행합니다.
   - `participants`, 옵션 마스터 테이블, 매핑 테이블, RLS 정책, RPC 함수, 초기 옵션 3개(매력 포인트/이상형 각각)가 한 번에 생성됩니다.
3. 프로젝트의 **Project Settings > API**에서 `Project URL`과 `anon public` 키를 확인합니다.
4. 루트에 `.env.local` 파일을 만들고 [`.env.local.example`](.env.local.example)을 참고해 값을 채웁니다.

```bash
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

5. `npm run dev`로 서버를 재시작하면 실제 Supabase에 신청 데이터가 저장됩니다.

> `SUPABASE_URL` / `SUPABASE_ANON_KEY`는 `NEXT_PUBLIC_` 접두사 없이 서버(Server Action)에서만 사용됩니다. 클라이언트 번들에는 절대 노출되지 않습니다.

## 3. 데이터베이스 설계 요약

- **participants**: 참가자 본체 (성별, 이름, 나이(한국식), 전공, 전화번호, 희망 매칭 인원). `phone`에 UNIQUE 제약을 걸어 중복 신청을 DB 레벨에서 방지합니다.
- **appeal_point_options / ideal_type_options**: "매력 어필 포인트"와 "이상형" 체크박스 문구를 담는 마스터 테이블. 문구가 나중에 추가/수정돼도 기존 참가자 데이터를 건드리지 않습니다. (JSONB 배열 대신 정규화한 이유는 `supabase/schema.sql` 상단 주석과 커밋 히스토리 참고)
- **participant_appeal_points / participant_ideal_types**: 참가자와 옵션을 연결하는 N:M 매핑 테이블. AI 매칭 로직에서 "특정 옵션을 선택한 사람" 조회가 빠르도록 인덱스를 걸어뒀습니다.
- **create_participant_application(...)**: 신청 1건(참가자 + 선택한 옵션들)을 하나의 트랜잭션으로 저장하는 Postgres 함수. `SECURITY DEFINER`로 실행되어 익명 사용자는 이 함수를 통해서만 데이터를 쓸 수 있고, 테이블에 직접 INSERT/SELECT/UPDATE/DELETE 할 수 없습니다.
- **RLS**: 옵션 테이블은 활성화된 항목만 공개 조회 가능, 참가자 관련 테이블은 익명 사용자에게 어떤 직접 접근 권한도 주지 않습니다 (전화번호 등 개인정보 보호 목적).

옵션 문구를 추가/비활성화하려면 Supabase Studio의 Table Editor에서 `appeal_point_options` / `ideal_type_options`에 행을 추가하거나 `is_active`를 `false`로 바꾸면 됩니다.

## 4. 중복 신청 방지

1. **DB**: `participants.phone` UNIQUE 제약 (최종 방어선, 동시 요청에도 안전)
2. **서버**: 중복 전화번호로 신청 시 Postgres unique violation(`23505`)을 잡아 전화번호 입력창에 "이미 신청이 완료된 전화번호예요" 에러를 표시합니다.
3. **클라이언트(보조)**: 신청 성공 시 브라우저 `localStorage`에 플래그를 저장해, 같은 기기로 재방문 시 폼 대신 "이미 신청했어요" 화면을 바로 보여줍니다.

## 5. 프로젝트 구조

```
app/
  page.tsx                — 랜딩 (성별 선택)
  apply/[gender]/
    page.tsx               — 신청 폼 페이지 (옵션 목록을 서버에서 조회)
    actions.ts              — 신청 제출 Server Action
components/
  GenderPicker.tsx          — 랜딩 좌/우 분할 UI
  ApplicationForm.tsx        — 신청 폼 (성공/중복신청 화면 포함)
  CheckboxOptionGroup.tsx    — 매력 포인트/이상형 체크박스 (옵션 배열 기반 자동 레이아웃)
  ui/                        — 공용 입력 컴포넌트
lib/
  supabase/                 — Supabase 서버 클라이언트 & 타입
  validation.ts              — zod 폼 스키마
supabase/
  schema.sql                 — 전체 DB 스키마 (SQL Editor에서 1회 실행)
```
