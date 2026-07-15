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
### 주제 기반 유동 분류
콘텐츠의 "형식"이 아니라 "주제"로 분류한다. 같은 유튜브 링크라도
강의면 '공부', 요리 영상이면 '요리'. 고정 카테고리는 없다 —
대분류(주제)·세부주제 모두 LLM 판정과 사용자 편집으로 만들어진다.

저장 시 두 단계:
1. **형식 판정** (`lib/classify.js`의 `detectFormat`) — 도메인 규칙(`lib/domainRules.js`)
   + og:type으로 영상/상품/아티클/기타 판정. 비용 0. 주제 판정의 힌트로 쓴다.
2. **주제 판정** (`lib/classifyTopic.js`의 `classifyTopic`, 서버 전용) — Gemini가
   제목·설명 + 기존 카테고리 목록을 보고 판정. 기존 카테고리 재사용 우선,
   없을 때만 신규 제안. `{ topic, sub, isNew, method }` 반환.
   method는 'llm' | 'fallback'. 실패 시 '기타'(FALLBACK_TOPIC)로.
   같은 도메인+제목은 서버 메모리에 캐싱해 중복 호출 방지.

중복 방지의 최종 방어선은 클라이언트(`app/page.js` addLink)의
이름 기반 find-or-create — 같은 이름의 카테고리는 항상 재사용된다.
링크가 0개인 카테고리는 사이드바에 표시하지 않는다 (링크 이동 메뉴에는 표시).

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