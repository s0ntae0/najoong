-- 나중(Najoong) 스키마. Supabase 대시보드 > SQL Editor에서 전체 실행.
--
-- 이미 구버전 테이블이 있는 프로젝트는 아래 업그레이드 구문도 실행:
--   alter table public.links add column if not exists parse_failed boolean not null default false;

-- ============================================================
-- profiles: auth.users 연결
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: 본인 조회" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: 본인 수정" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 회원가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- categories: user_id 소유, parent_id 셀프조인 (대분류=주제 / 하위=세부주제)
--   주제 기반 유동 분류: 고정 카테고리 없음, LLM 판정·사용자 편집으로 생성.
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories (user_id);

alter table public.categories enable row level security;

create policy "categories: 본인 전체" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- links
--   category_id: 최종 배치 / auto_category: 자동 판정 기록 (정확도 개선용 분리 보존)
-- ============================================================
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  title text not null default '',
  description text not null default '',
  image_url text not null default '',
  domain text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  auto_category text,
  classify_method text check (classify_method in ('domain', 'og_type', 'llm', 'fallback')),
  parse_failed boolean not null default false,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists links_user_idx on public.links (user_id, created_at desc);
create index if not exists links_category_idx on public.links (category_id);

alter table public.links enable row level security;

create policy "links: 본인 전체" on public.links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 테이블 권한 (GRANT)
--   RLS 정책은 "행" 필터일 뿐, 롤에 테이블 권한이 없으면 RLS 이전에
--   permission denied(42501)로 거부된다. 반드시 함께 실행할 것.
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.links to authenticated;

-- ============================================================
-- domain_rules: 전역 공유. 읽기 전체 허용 / 쓰기는 service_role만 (정책 없음 = RLS 우회만 가능)
-- ============================================================
create table if not exists public.domain_rules (
  id bigint generated always as identity primary key,
  domain text not null unique,
  category text not null check (category in ('shopping', 'video', 'news', 'etc')),
  created_at timestamptz not null default now()
);

alter table public.domain_rules enable row level security;

create policy "domain_rules: 전체 읽기" on public.domain_rules
  for select using (true);

grant select on public.domain_rules to anon, authenticated;

-- 시드 (lib/domainRules.js와 동일)
insert into public.domain_rules (domain, category) values
  ('musinsa.com', 'shopping'),
  ('coupang.com', 'shopping'),
  ('29cm.co.kr', 'shopping'),
  ('zigzag.kr', 'shopping'),
  ('kream.co.kr', 'shopping'),
  ('a-bly.com', 'shopping'),
  ('ohou.se', 'shopping'),
  ('smartstore.naver.com', 'shopping'),
  ('brand.naver.com', 'shopping'),
  ('shopping.naver.com', 'shopping'),
  ('gmarket.co.kr', 'shopping'),
  ('11st.co.kr', 'shopping'),
  ('oliveyoung.co.kr', 'shopping'),
  ('wconcept.co.kr', 'shopping'),
  ('ably.co.kr', 'shopping'),
  ('aliexpress.com', 'shopping'),
  ('youtube.com', 'video'),
  ('youtu.be', 'video'),
  ('vimeo.com', 'video'),
  ('tv.naver.com', 'video'),
  ('chzzk.naver.com', 'video'),
  ('twitch.tv', 'video'),
  ('netflix.com', 'video'),
  ('tving.com', 'video'),
  ('wavve.com', 'video'),
  ('news.naver.com', 'news'),
  ('n.news.naver.com', 'news'),
  ('ytn.co.kr', 'news'),
  ('news.daum.net', 'news'),
  ('v.daum.net', 'news'),
  ('yna.co.kr', 'news'),
  ('chosun.com', 'news'),
  ('joongang.co.kr', 'news'),
  ('donga.com', 'news'),
  ('hani.co.kr', 'news'),
  ('khan.co.kr', 'news'),
  ('hankyung.com', 'news'),
  ('mk.co.kr', 'news'),
  ('sedaily.com', 'news'),
  ('etnews.com', 'news'),
  ('zdnet.co.kr', 'news')
on conflict (domain) do nothing;
