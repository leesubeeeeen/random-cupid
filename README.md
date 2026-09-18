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
   - `participants`, 옵션 마스터 테이블, 매핑 테이블, RLS 정책, RPC 함수, 성별별 초기 옵션(남/여 각 3개)이 한 번에 생성됩니다.
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
- **appeal_point_options**: "매력 어필 포인트" 체크박스 문구를 담는 마스터 테이블. `gender_scope`(`male`/`female`/`all`)로 자기소개용 노출 대상을 지정합니다. (JSONB 배열 대신 정규화한 이유는 `supabase/schema.sql` 상단 주석과 커밋 히스토리 참고)
- **ideal_type_options**: "이상형" 질문에만 추가로 노출되는 전용 옵션 마스터. `gender_scope`는 "이 옵션을 볼 사람"의 성별입니다.
  - **"이상형" 체크박스 목록 = 반대 성별의 `appeal_point_options`(자동 연결) + `ideal_type_options`(직접 추가한 이상형 전용 옵션)을 합친 것**입니다. 예: 남성 신청 폼의 "선호하는 이상형"에는 여성 어필 포인트 전부 + `ideal_type_options`에서 `gender_scope = 'male'`(또는 `'all'`)인 옵션이 함께 뜹니다.
- **participant_appeal_points**: 참가자 ↔ `appeal_point_options` N:M 매핑.
- **participant_ideal_types**: 참가자가 고른 "이상형" 항목 매핑. `appeal_point_option_id` / `ideal_type_option_id` 두 컬럼 중 **정확히 하나만** 채워져서 어느 소스에서 온 선택인지 구분합니다 (`participant_ideal_types_exactly_one_source` 체크 제약).
- **participant_applications_readable** (뷰): 위 테이블들을 조인해서 UUID 대신 실제 선택 문구를 바로 보여주는 조회 전용 뷰. 자세한 건 아래 "6. 신청 데이터 조회하기" 참고.
- **create_participant_application(...)**: 신청 1건(참가자 + 선택한 옵션들)을 하나의 트랜잭션으로 저장하는 Postgres 함수. `SECURITY DEFINER`로 실행되어 익명 사용자는 이 함수를 통해서만 데이터를 쓸 수 있고, 테이블에 직접 INSERT/SELECT/UPDATE/DELETE 할 수 없습니다.
- **RLS**: 옵션 테이블은 활성화된 항목만 공개 조회 가능, 참가자 관련 테이블·조회용 뷰는 익명 사용자에게 어떤 직접 접근 권한도 주지 않습니다 (전화번호 등 개인정보 보호 목적).

옵션 문구를 추가/비활성화하려면 Supabase Studio의 Table Editor에서 `appeal_point_options`(자기소개 + 반대 성별 이상형에 자동 노출) 또는 `ideal_type_options`(이상형 전용 추가 옵션)에 행을 추가하거나 `is_active`를 `false`로 바꾸면 됩니다.

> **기존 Supabase 프로젝트를 이미 만들었다면**: `supabase/migrations/` 안의 파일을 번호 순서대로(`001` → `002`) SQL Editor에서 1회씩 실행해야 합니다 (기존 데이터는 삭제하지 않습니다). 신규 프로젝트는 `schema.sql`에 전부 반영되어 있어 따로 실행할 필요 없습니다.

## 4. 중복 신청 방지

여러 사람이 한 대의 기기(예: 행사장 태블릿)로 돌아가며 신청할 수 있으므로, 기기 단위가 아니라 **전화번호 단위**로만 막습니다.

1. **DB**: `participants.phone` UNIQUE 제약 (최종 방어선, 동시 요청에도 안전)
2. **서버**: 중복 전화번호로 신청 시 Postgres unique violation(`23505`)을 잡아 전화번호 입력창에 "이미 신청이 완료된 전화번호예요" 에러를 표시합니다.

## 5. 신청 데이터 조회하기

원본 테이블(`participants`, `participant_appeal_points`, `participant_ideal_types`)만 보면 선택한 옵션이 UUID로 저장돼 있어 바로 읽기 어렵습니다. `participant_applications_readable` 뷰가 라벨까지 조인해서 보여줍니다.

1. Supabase 프로젝트의 **SQL Editor**에서:
   ```sql
   select * from public.participant_applications_readable;
   ```
   `appeal_points`, `ideal_types` 컬럼에 선택한 문구가 쉼표로 이어진 텍스트로 나옵니다.
2. 또는 **Table Editor > Views**에서 `participant_applications_readable`를 열어 표로 보거나 우측 상단 **Export**로 CSV 다운로드할 수 있습니다.
3. 이 뷰는 익명 사용자에게 권한을 주지 않았기 때문에 앱(브라우저)에서는 조회되지 않고, Supabase 대시보드에 로그인한 관리자만 볼 수 있습니다.

> 아직 이 뷰가 없다면 [`supabase/migrations/002_readable_view.sql`](supabase/migrations/002_readable_view.sql)을 SQL Editor에서 실행하세요 (신규 프로젝트는 `schema.sql`에 이미 포함되어 있습니다).

## 6. 프로젝트 구조

```
app/
  page.tsx                — 랜딩 (성별 선택)
  apply/[gender]/
    page.tsx               — 신청 폼 페이지 (옵션 목록을 서버에서 조회)
    actions.ts              — 신청 제출 Server Action
    form-state.ts            — 폼 상태 타입/초기값 ("use server" 파일은 async 함수만 export 가능해서 분리)
components/
  GenderPicker.tsx          — 랜딩 좌/우 분할 UI
  ApplicationForm.tsx        — 신청 폼 (성공/중복신청 화면 포함)
  CheckboxOptionGroup.tsx    — 매력 포인트/이상형 체크박스 (옵션 배열 기반 자동 레이아웃)
  ui/                        — 공용 입력 컴포넌트
lib/
  supabase/                 — Supabase 서버 클라이언트 & 타입
  validation.ts              — zod 폼 스키마
supabase/
  schema.sql                 — 전체 DB 스키마 (신규 프로젝트: SQL Editor에서 1회 실행)
  migrations/                — 기존 프로젝트에 순서대로 적용하는 증분 마이그레이션
```
