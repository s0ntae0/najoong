// 비회원 저장소: localStorage. 로그인 시 user_id 붙여 Supabase로 이관 후 정리(clearGuestData).

const LINKS_KEY = "najoong:links";
const CATEGORIES_KEY = "najoong:categories";

// 비회원 최대 저장 개수. 초과 시도 시 로그인 모달.
export const GUEST_LIMIT = 5;

// 리밋 스위치. false로 내리면 리밋·관련 UI 문구가 꺼진다 (테스트용).
export const GUEST_LIMIT_ENABLED = true;

export function loadGuestLinks() {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveGuestLinks(links) {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

// 시드 없음 — 서랍이 비어 있으면 첫 저장 때 LLM이 카테고리를 만든다
export function loadGuestCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    if (Array.isArray(stored)) return stored;
  } catch {
    // 손상된 데이터는 빈 서랍으로
  }
  return [];
}

export function saveGuestCategories(categories) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function clearGuestData() {
  localStorage.removeItem(LINKS_KEY);
  localStorage.removeItem(CATEGORIES_KEY);
}
