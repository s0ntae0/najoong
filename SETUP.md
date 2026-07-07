# 나중(Najoong) 셋업 가이드

앱은 아무 설정 없이도 **비회원 모드**(localStorage, 최대 5개)로 동작합니다.
로그인·DB·LLM 분류를 켜려면 아래 순서대로 설정하세요.

## 1. Supabase 스키마 생성

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트(xwyyjdrgxjlwongosxfz) → **SQL Editor**
2. `supabase/schema.sql` 내용 전체를 붙여넣고 **Run**
   - profiles / categories / links / domain_rules 테이블 + RLS 정책 + domain_rules 시드가 생성됩니다.

## 2. anon key 연결

1. 대시보드 → **Project Settings → API** → `anon` `public` 키 복사
2. `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY=` 뒤에 붙여넣기
3. dev 서버 재시작 (`npm run dev`)

## 3. Auth 설정

- **이메일**: 기본 활성화. 개발 중 확인 메일 없이 바로 로그인하려면
  Authentication → Sign In / Up → Email → **Confirm email 끄기**
- **구글 OAuth**:
  1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 OAuth 클라이언트 ID 생성 (웹 애플리케이션)
  2. 승인된 리디렉션 URI에 `https://xwyyjdrgxjlwongosxfz.supabase.co/auth/v1/callback` 추가
  3. Supabase → Authentication → Providers → Google에 Client ID/Secret 입력
- Authentication → **URL Configuration** → Site URL에 `http://localhost:3000` 설정
  (배포 후 Vercel URL을 Redirect URLs에 추가)

## 4. LLM 분류 폴백 (선택)

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급
2. `.env.local`의 `GEMINI_API_KEY=` 뒤에 붙여넣기
3. dev 서버 재시작

키가 없으면 LLM 단계는 건너뛰고 '기타'로 분류됩니다 (앱 동작에는 지장 없음).

## 동작 확인 순서

1. 비회원으로 링크 5개 저장 → 6번째에 로그인 모달 확인
2. 가입/로그인 → 비회원 링크가 계정으로 이관됐는지 확인 (사이드바 개수)
3. 도메인 룰에 없는 개인 블로그 링크 저장 → AI 분류(LLM) 동작 확인
