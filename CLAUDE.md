# 나중 (Najoong)

흩어진 링크를 한 곳에 저장하고 자동 분류해주는 웹 서비스.
"나중에 볼 것"을 넣어두는 서랍. 볼지 말지는 사용자의 몫이고,
서비스는 잘 저장하고 잘 꺼내주는 역할에 집중한다.

## 기술 스택
- Next.js (App Router) + React
- Tailwind CSS
- Supabase (Auth + DB)
- og 파싱: Next.js API Route (서버사이드, CORS 우회)
- 배포: Vercel

## 프로젝트 구조
- `app/` — 페이지, API Route (`app/api/parse/route.js`가 파싱 담당)
- `components/` — UI 컴포넌트 (Sidebar, HomeView, FeedView, LinkCard, DrawerInput 등)
- `lib/` — 로직 모듈 (classify, domainRules, storage, db, supabase, format)
- `supabase/schema.sql` — DB 스키마

## 핵심 개념
### 자동 분류 파이프라인 (싸고 빠른 순서, 확정되면 중단)
1. 도메인 규칙 (`lib/domainRules.js`) — 알려진 사이트 즉시 판별, 비용 0
2. og:type 메타태그 — 등록 안 된 개인 쇼핑몰도 판별, 비용 0
3. LLM 폴백 — 애매한 것만 (아직 미구현)
4. 폴백 — 기타

`lib/classify.js`의 `classify({ domain, ogType })`가 담당.
`{ category, method }` 반환. method는 'domain' | 'og_type' | 'fallback'.

### 왜 서버가 필요한가
브라우저에서 외부 사이트를 직접 fetch하면 CORS로 막힌다.
그래서 og 파싱은 반드시 API Route(서버)에서 처리한다.

### 데이터 저장
- 비회원: localStorage 최대 5개
- 회원: Supabase (로그인 시 localStorage 데이터를 계정으로 이관)

## 개발 규칙
- 커밋 메시지는 한글로, 컨벤셔널 커밋 프리픽스 사용 (feat:, fix:, docs: 등)
- `.env.local`은 절대 커밋하지 않는다
- 기능 추가 시 기존 구조를 존중하고, 전체를 갈아엎지 않는다