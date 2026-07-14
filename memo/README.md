# memo — 배포 가이드

프론트: `memo/memo.html` (정적)
백엔드: Supabase — `memos` 테이블 + Edge Function `memo`

## 1. DB 마이그레이션

Supabase SQL Editor 에 `supabase/migrations/0001_memos.sql` 내용을 붙여 실행하거나:

```bash
supabase db push
```

- `anon` 은 `id, content, created_at` 컬럼만 SELECT 가능 (비밀번호 해시 노출 차단)
- INSERT / DELETE 정책 없음 → Edge Function(service_role)만 쓰기 가능

## 2. Cloudflare Turnstile 키 발급

<https://dash.cloudflare.com> → Turnstile → 위젯 추가 (도메인 등록)

- **사이트 키** → `memo/memo.html` 의 `TURNSTILE_SITE_KEY` 교체
  (기본값 `1x00000000000000000000AA` 는 항상 통과하는 **테스트 키**. 실서비스 전 반드시 교체)
- **시크릿 키** → 아래 3번 `TURNSTILE_SECRET`

## 3. Edge Function 배포

```bash
supabase secrets set TURNSTILE_SECRET=<시크릿키>
supabase secrets set MEMO_MASTER_PASSWORD=dnjsejfoqwhrjsgml
supabase secrets set MEMO_IP_PEPPER=<임의 문자열>
supabase functions deploy memo
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 런타임이 자동 주입.

## 스팸 방지 3종 (전부 서버 판정)

| 항목 | 구현 |
|---|---|
| 봇 판별 | Turnstile 토큰을 `siteverify` 로 시크릿 검증 |
| 한국 외 IP 게시 금지 | `cf-ipcountry` 헤더 → 없으면 ipwho.is → api.country.is 순 조회. `KR` 아니면 403 |
| 3초 이내 게시 차단 | siteverify 의 `challenge_ts`(챌린지 통과 시각)과 현재 시각 차이가 3초 미만이면 429 |

추가로 IP 해시 기준 **시간당 20건** 제한.

## 기능

- 게시: 내용 + 비밀번호(메모당 1:1)
- 삭제: 해당 메모 비밀번호 또는 마스터 비밀번호 `dnjsejfoqwhrjsgml`
- 복사: 메모 옆 `복사` 버튼 → 클립보드
- 메모 내용은 부분 드래그 선택 가능 (`user-select: text`)

## 주의

- 비밀번호는 PBKDF2-SHA256(10만 회, 메모별 salt)로 해시 저장. 평문 저장 안 함.
- 마스터 비밀번호가 소스에 노출되지 않도록 `MEMO_MASTER_PASSWORD` 시크릿을 반드시 설정하세요
  (미설정 시 코드 내 기본값이 쓰임).
