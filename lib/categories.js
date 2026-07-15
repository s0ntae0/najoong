// 카테고리는 사용자 소유 데이터 (로그인: Supabase categories 테이블 / 비회원: localStorage).
// 주제 기반 유동 분류: 대분류(주제)와 세부주제 모두 LLM 판정·사용자 편집으로 만들어진다.
// 하드코딩된 기본 카테고리는 없다 — 서랍이 비어 있으면 첫 저장 때 LLM이 만든다.
// 카테고리 공통 형태: { id, name, slug?, parentId, isDefault?, createdAt }
// (slug·isDefault는 구버전 데이터 호환용 — 새 카테고리는 사용하지 않는다)

// LLM 실패·판단 불가 시 링크가 떨어지는 폴백 대분류 이름
export const FALLBACK_TOPIC = "기타";

// 평면 리스트 → 사이드바용 트리 (생성순, '기타'는 항상 마지막)
export function buildTree(categories) {
  return categories
    .filter((c) => !c.parentId)
    .sort((a, b) => {
      if (a.name === FALLBACK_TOPIC !== (b.name === FALLBACK_TOPIC)) {
        return a.name === FALLBACK_TOPIC ? 1 : -1;
      }
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    })
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

// 같은 부모 아래 같은 이름의 카테고리 찾기 — 중복 생성 방지의 기준
export function findByName(categories, name, parentId = null) {
  return (
    categories.find((c) => (c.parentId ?? null) === (parentId ?? null) && c.name === name) ?? null
  );
}
