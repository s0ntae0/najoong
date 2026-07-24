// Supabase CRUD 계층. 로그인 사용자 전용 — 호출 전에 user 존재가 보장된다.
import { supabase } from "./supabase";
import { FALLBACK_TOPIC } from "./categories";

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

// 카테고리(들) 삭제 — 대분류는 세부주제 id까지 함께 넘긴다.
// deleteLinks=true: 소속 링크도 함께 삭제 / false: fallbackCategoryId로 이동 후 삭제.
// fallbackCategoryId가 null이면 옮길 링크가 없다는 뜻 (호출부에서 보장).
export async function deleteCategoryTree(ids, fallbackCategoryId, deleteLinks = false) {
  if (deleteLinks) {
    const { error: linkError } = await supabase.from("links").delete().in("category_id", ids);
    if (linkError) throw linkError;
  } else if (fallbackCategoryId) {
    const { error: moveError } = await supabase
      .from("links")
      .update({ category_id: fallbackCategoryId })
      .in("category_id", ids);
    if (moveError) throw moveError;
  }
  const { error } = await supabase.from("categories").delete().in("id", ids);
  if (error) throw error;
}

// 비회원 localStorage 데이터를 user_id 붙여 DB로 이관.
// 카테고리는 유동(주제) 구조라 slug가 아닌 '이름'으로 매핑 — 같은 이름이 있으면 재사용, 없으면 생성.
// 이관했으면 true 반환 (호출부에서 localStorage 정리).
export async function migrateGuestData(userId, dbCategories, guestLinks, guestCategories) {
  if (guestLinks.length === 0) return false;

  const cats = [...dbCategories]; // 이관 중 생성분 포함 작업 목록
  const ensure = async (name, parentId = null) => {
    let match = cats.find(
      (c) => (c.parentId ?? null) === (parentId ?? null) && c.name === name
    );
    if (!match) {
      match = await insertCategory(userId, parentId, name);
      cats.push(match);
    }
    return match;
  };

  const idMap = {}; // 게스트 카테고리 id → DB 카테고리 id
  for (const cat of guestCategories.filter((c) => !c.parentId)) {
    idMap[cat.id] = (await ensure(cat.name)).id;
  }
  for (const cat of guestCategories.filter((c) => c.parentId)) {
    const majorDbId = idMap[cat.parentId];
    if (!majorDbId) continue;
    idMap[cat.id] = (await ensure(cat.name, majorDbId)).id;
  }

  // 매핑 실패한 링크가 떨어질 폴백 대분류
  const etcId = (await ensure(FALLBACK_TOPIC)).id;
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
