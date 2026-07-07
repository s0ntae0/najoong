// Supabase CRUD 계층. 로그인 사용자 전용 — 호출 전에 user 존재가 보장된다.
import { supabase } from "./supabase";
import { DEFAULT_MAJORS, DEFAULT_SUBS } from "./categories";

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapLink(row) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    domain: row.domain,
    categoryId: row.category_id,
    autoCategory: row.auto_category,
    classifyMethod: row.classify_method,
    parseFailed: row.parse_failed,
    isRead: row.is_read,
    savedAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchCategories(userId) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data.map(mapCategory);
}

// 첫 로그인: 기본 대분류 4개 + 기본 하위 카테고리 생성
export async function createDefaultCategories(userId) {
  const majorRows = DEFAULT_MAJORS.map((m) => ({
    user_id: userId,
    name: m.name,
    slug: m.slug,
    is_default: true,
  }));
  const { data: majors, error } = await supabase
    .from("categories")
    .insert(majorRows)
    .select();
  if (error) throw error;

  const subRows = [];
  for (const major of majors) {
    for (const name of DEFAULT_SUBS[major.slug] ?? []) {
      subRows.push({ user_id: userId, name, parent_id: major.id, is_default: true });
    }
  }
  let subs = [];
  if (subRows.length > 0) {
    const { data, error: subError } = await supabase
      .from("categories")
      .insert(subRows)
      .select();
    if (subError) throw subError;
    subs = data;
  }
  return [...majors, ...subs].map(mapCategory);
}

export async function fetchLinks(userId) {
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapLink);
}

export async function insertLink(userId, link) {
  const { data, error } = await supabase
    .from("links")
    .insert({
      user_id: userId,
      url: link.url,
      title: link.title,
      description: link.description,
      image_url: link.imageUrl,
      domain: link.domain,
      category_id: link.categoryId,
      auto_category: link.autoCategory,
      classify_method: link.classifyMethod,
      parse_failed: !!link.parseFailed,
    })
    .select()
    .single();
  if (error) throw error;
  return mapLink(data);
}

export async function deleteLink(id) {
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw error;
}

export async function updateLinkCategory(id, categoryId) {
  const { error } = await supabase.from("links").update({ category_id: categoryId }).eq("id", id);
  if (error) throw error;
}

export async function insertCategory(userId, parentId, name) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, parent_id: parentId, name })
    .select()
    .single();
  if (error) throw error;
  return mapCategory(data);
}

export async function renameCategory(id, name) {
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) throw error;
}

// 삭제 전 소속 링크를 fallback(대분류)으로 이동
export async function deleteCategory(id, fallbackCategoryId) {
  const { error: moveError } = await supabase
    .from("links")
    .update({ category_id: fallbackCategoryId })
    .eq("category_id", id);
  if (moveError) throw moveError;
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

// 비회원 localStorage 데이터를 user_id 붙여 DB로 이관.
// 커스텀 하위 카테고리는 이름이 같은 것이 있으면 재사용, 없으면 생성.
// 이관했으면 true 반환 (호출부에서 localStorage 정리).
export async function migrateGuestData(userId, dbCategories, guestLinks, guestCategories) {
  if (guestLinks.length === 0) return false;

  const idMap = {}; // 게스트 카테고리 id → DB 카테고리 id

  for (const cat of guestCategories.filter((c) => !c.parentId)) {
    const match = dbCategories.find((c) => !c.parentId && c.slug === cat.slug);
    if (match) idMap[cat.id] = match.id;
  }
  for (const cat of guestCategories.filter((c) => c.parentId)) {
    const majorDbId = idMap[cat.parentId];
    if (!majorDbId) continue;
    const existing = dbCategories.find((c) => c.parentId === majorDbId && c.name === cat.name);
    if (existing) {
      idMap[cat.id] = existing.id;
    } else {
      // 커스텀이든 이름을 바꾼 기본 하위든, 같은 이름이 없으면 만들어서 보존
      const created = await insertCategory(userId, majorDbId, cat.name);
      idMap[cat.id] = created.id;
    }
  }

  const etcId = dbCategories.find((c) => !c.parentId && c.slug === "etc")?.id ?? null;
  const rows = guestLinks.map((link) => ({
    user_id: userId,
    url: link.url,
    title: link.title ?? "",
    description: link.description ?? "",
    image_url: link.imageUrl ?? "",
    domain: link.domain ?? "",
    category_id: idMap[link.categoryId] ?? etcId,
    auto_category: link.autoCategory ?? null,
    classify_method: link.classifyMethod ?? null,
    parse_failed: !!link.parseFailed,
    created_at: new Date(link.savedAt ?? Date.now()).toISOString(),
  }));

  const { error } = await supabase.from("links").insert(rows);
  if (error) throw error;
  return true;
}
