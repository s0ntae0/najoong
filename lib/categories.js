// 카테고리는 사용자 소유 데이터 (로그인: Supabase categories 테이블 / 비회원: localStorage).
// 대분류 4개는 자동 분류 파이프라인의 판정 대상이므로 고정(삭제·이름변경 불가), 하위만 편집 가능.
// 카테고리 공통 형태: { id, name, slug, parentId, isDefault, createdAt }

export const MAJOR_SLUGS = ["shopping", "video", "news", "etc"];

export const DEFAULT_MAJORS = [
  { slug: "shopping", name: "쇼핑" },
  { slug: "video", name: "영상" },
  { slug: "news", name: "뉴스" },
  { slug: "etc", name: "기타" },
];

export const DEFAULT_SUBS = {
  shopping: ["패션", "뷰티", "리빙"],
  video: ["유튜브", "드라마·예능"],
  news: ["IT·테크", "경제"],
  etc: [],
};

// 평면 리스트 → 사이드바용 트리 (대분류는 고정 순서, 하위는 생성순)
export function buildTree(categories) {
  return categories
    .filter((c) => !c.parentId)
    .sort((a, b) => MAJOR_SLUGS.indexOf(a.slug) - MAJOR_SLUGS.indexOf(b.slug))
    .map((major) => ({
      ...major,
      children: categories
        .filter((c) => c.parentId === major.id)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    }));
}

export function findCategory(categories, id) {
  return categories.find((c) => c.id === id) ?? null;
}

// 해당 카테고리가 속한 대분류 id (대분류면 자기 자신)
export function majorOf(categories, id) {
  const cat = findCategory(categories, id);
  if (!cat) return null;
  return cat.parentId ?? cat.id;
}

export function majorBySlug(categories, slug) {
  return categories.find((c) => !c.parentId && c.slug === slug) ?? null;
}
