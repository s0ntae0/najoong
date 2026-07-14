// 비회원 저장소: localStorage. 로그인 시 user_id 붙여 Supabase로 이관 후 정리(clearGuestData).
import { DEFAULT_MAJORS, DEFAULT_SUBS } from "./categories";

const LINKS_KEY = "najoong:links";
const CATEGORIES_KEY = "najoong:categories";

// 비회원 최대 저장 개수. 초과 시도 시 로그인 모달.
export const GUEST_LIMIT = 5;

// 임시 해제 스위치 (테스트용). true로 되돌리면 리밋·관련 UI 문구 복구.
export const GUEST_LIMIT_ENABLED = false;

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

export function loadGuestCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {
    // 손상된 데이터는 시드로 대체
  }
  const seed = seedGuestCategories();
  saveGuestCategories(seed);
  return seed;
}

export function saveGuestCategories(categories) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function clearGuestData() {
  localStorage.removeItem(LINKS_KEY);
  localStorage.removeItem(CATEGORIES_KEY);
}

// 대분류 id는 slug 그대로 사용 — 분류 파이프라인 결과(slug)와 바로 이어진다
function seedGuestCategories() {
  const now = Date.now();
  const categories = [];
  for (const major of DEFAULT_MAJORS) {
    categories.push({
      id: major.slug,
      name: major.name,
      slug: major.slug,
      parentId: null,
      isDefault: true,
      createdAt: now,
    });
    for (const name of DEFAULT_SUBS[major.slug]) {
      categories.push({
        id: crypto.randomUUID(),
        name,
        slug: null,
        parentId: major.slug,
        isDefault: true,
        createdAt: now,
      });
    }
  }
  return categories;
}
