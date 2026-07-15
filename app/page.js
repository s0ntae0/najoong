"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileTabBar from "@/components/MobileTabBar";
import HomeView from "@/components/HomeView";
import FeedView from "@/components/FeedView";
import AuthModal from "@/components/AuthModal";
import { buildTree, findCategory, findByName, majorOf, FALLBACK_TOPIC } from "@/lib/categories";
import {
  GUEST_LIMIT,
  GUEST_LIMIT_ENABLED,
  loadGuestLinks,
  saveGuestLinks,
  loadGuestCategories,
  saveGuestCategories,
  clearGuestData,
} from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import * as db from "@/lib/db";

// 게스트용 카테고리 객체 생성 (로그인 시에는 db.insertCategory가 대신한다)
function guestCategory(name, parentId = null) {
  return {
    id: crypto.randomUUID(),
    name,
    slug: null,
    parentId,
    isDefault: false,
    createdAt: Date.now(),
  };
}

export default function Page() {
  const [user, setUser] = useState(null);
  // supabase 미설정이면 세션 조회가 없으므로 처음부터 ready
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [links, setLinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("home");
  const [authOpen, setAuthOpen] = useState(false);

  // --- 세션 감지 ---
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      // TOKEN_REFRESHED 등 같은 유저의 반복 이벤트로 데이터 재로드가 돌지 않도록 id 기준 비교
      setUser((prev) => (prev?.id === next?.id ? prev : next));
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // --- 데이터 로드: 게스트 ↔ DB 전환 + 로그인 직후 게스트 데이터 이관 ---
  // 카테고리 시드는 없다 — 서랍이 비어 있으면 첫 저장 때 LLM이 만든다.
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (user && supabase) {
          let cats = await db.fetchCategories(user.id);
          const migrated = await db.migrateGuestData(
            user.id,
            cats,
            loadGuestLinks(),
            loadGuestCategories()
          );
          if (migrated) {
            clearGuestData();
            cats = await db.fetchCategories(user.id);
          }
          const rows = await db.fetchLinks(user.id);
          if (!cancelled) {
            setCategories(cats);
            setLinks(rows);
          }
        } else if (!cancelled) {
          setCategories(loadGuestCategories());
          setLinks(loadGuestLinks());
        }
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authReady]);

  // --- 게스트 데이터는 변경될 때마다 localStorage에 반영 ---
  useEffect(() => {
    if (authReady && !user && !loading) saveGuestLinks(links);
  }, [links, user, authReady, loading]);
  useEffect(() => {
    if (authReady && !user && !loading) saveGuestCategories(categories);
  }, [categories, user, authReady, loading]);

  // --- 링크 저장 (게스트 한도 게이트 포함) ---
  const addLink = useCallback(
    async (url) => {
      if (!user && GUEST_LIMIT_ENABLED && links.length >= GUEST_LIMIT) {
        setAuthOpen(true);
        return null; // 6번째 시도 → 로그인 모달
      }

      // LLM 프롬프트용 현재 서랍 요약: [{ name, subs: [이름] }]
      const tree = buildTree(categories);
      const promptCategories = tree.map((m) => ({
        name: m.name,
        subs: m.children.map((c) => c.name),
      }));

      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, categories: promptCategories }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "링크를 저장하지 못했어요.");

      // 판정된 주제(대분류) → 세부주제 순서로 이름 기반 find-or-create.
      // 같은 이름은 항상 재사용 — 중복 카테고리가 생기지 않는다.
      let working = categories;
      const created = [];
      const ensureCategory = async (name, parentId = null) => {
        const existing = findByName(working, name, parentId);
        if (existing) return existing;
        const category = user
          ? await db.insertCategory(user.id, parentId, name)
          : guestCategory(name, parentId);
        working = [...working, category];
        created.push(category);
        return category;
      };

      const major = await ensureCategory(data.topic || FALLBACK_TOPIC);
      let categoryId = major.id;
      if (data.subTopic) {
        const sub = await ensureCategory(data.subTopic, major.id);
        categoryId = sub.id;
      }
      if (created.length > 0) {
        setCategories((prev) => {
          const next = [...prev];
          for (const c of created) {
            if (!findByName(next, c.name, c.parentId)) next.push(c);
          }
          return next;
        });
      }

      const base = {
        url: data.url,
        title: data.title || data.domain,
        description: data.description || "",
        imageUrl: data.image || "",
        domain: data.domain,
        categoryId, // 최종 배치 (사용자가 옮길 수 있음)
        autoCategory: data.topic, // 자동 판정 기록 보존 (정확도 개선용)
        classifyMethod: data.classifyMethod, // 'llm' | 'fallback'
        parseFailed: !!data.parseFailed,
        isRead: false,
      };
      const link = user
        ? await db.insertLink(user.id, base)
        : { id: crypto.randomUUID(), ...base, savedAt: Date.now() };
      setLinks((prev) => [link, ...prev]);
      return link;
    },
    [user, links.length, categories]
  );

  const removeLink = useCallback(
    (id) => {
      setLinks((prev) => prev.filter((link) => link.id !== id));
      if (user) db.deleteLink(id).catch(console.error);
    },
    [user]
  );

  const moveLink = useCallback(
    (id, categoryId) => {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, categoryId } : l)));
      if (user) db.updateLinkCategory(id, categoryId).catch(console.error);
    },
    [user]
  );

  // --- 카테고리 편집 (대분류·세부주제 모두 — AI 판정이 틀리면 사용자가 고친다) ---
  const addCategory = useCallback(
    async (parentId, name) => {
      if (findByName(categories, name, parentId ?? null)) return; // 같은 이름 중복 방지
      const category = user
        ? await db.insertCategory(user.id, parentId ?? null, name).catch((err) => {
            console.error(err);
            return null;
          })
        : guestCategory(name, parentId ?? null);
      if (category) {
        setCategories((prev) =>
          findByName(prev, name, parentId ?? null) ? prev : [...prev, category]
        );
      }
    },
    [user, categories]
  );

  const renameCategory = useCallback(
    (id, name) => {
      const category = findCategory(categories, id);
      if (!category || category.name === name) return;
      if (findByName(categories, name, category.parentId ?? null)) return; // 같은 이름 중복 방지
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      if (user) db.renameCategory(id, name).catch(console.error);
    },
    [user, categories]
  );

  const deleteCategory = useCallback(
    async (id) => {
      const category = findCategory(categories, id);
      if (!category) return;

      // 세부주제: 소속 링크는 대분류로 이동
      if (category.parentId) {
        setLinks((prev) =>
          prev.map((l) => (l.categoryId === id ? { ...l, categoryId: category.parentId } : l))
        );
        setCategories((prev) => prev.filter((c) => c.id !== id));
        setSelected((prev) => (prev === id ? category.parentId : prev));
        if (user) db.deleteCategory(id, category.parentId).catch(console.error);
        return;
      }

      // 대분류: 세부주제까지 함께 삭제, 소속 링크는 '기타'로 이동
      const childIds = categories.filter((c) => c.parentId === id).map((c) => c.id);
      const removedIds = new Set([id, ...childIds]);
      const hasLinks = links.some((l) => removedIds.has(l.categoryId));

      // '기타' 자체는 링크가 남아 있으면 삭제 불가 (링크가 갈 곳이 없다)
      if (hasLinks && category.name === FALLBACK_TOPIC) return;

      let etc = null;
      if (hasLinks) {
        etc = findByName(categories, FALLBACK_TOPIC, null);
        if (!etc) {
          etc = user
            ? await db.insertCategory(user.id, null, FALLBACK_TOPIC).catch((err) => {
                console.error(err);
                return null;
              })
            : guestCategory(FALLBACK_TOPIC);
          if (!etc) return;
        }
        const etcId = etc.id;
        setLinks((prev) =>
          prev.map((l) => (removedIds.has(l.categoryId) ? { ...l, categoryId: etcId } : l))
        );
      }

      setCategories((prev) => {
        const next = prev.filter((c) => !removedIds.has(c.id));
        if (etc && !findByName(next, FALLBACK_TOPIC, null)) next.push(etc);
        return next;
      });
      setSelected((prev) => (removedIds.has(prev) ? "home" : prev));
      if (user) db.deleteCategoryTree([id, ...childIds], etc?.id ?? null).catch(console.error);
    },
    [user, categories, links]
  );

  const handleLogout = useCallback(async () => {
    await supabase?.auth.signOut();
    setSelected("home");
  }, []);

  // --- 파생 상태 ---
  const tree = useMemo(() => buildTree(categories), [categories]);

  const counts = useMemo(() => {
    const result = {};
    for (const link of links) {
      result[link.categoryId] = (result[link.categoryId] || 0) + 1;
      const major = majorOf(categories, link.categoryId);
      if (major && major !== link.categoryId) result[major] = (result[major] || 0) + 1;
    }
    return result;
  }, [links, categories]);

  // 사이드바·탭바용: 링크가 하나도 없는 카테고리는 표시하지 않는다.
  // (링크 이동 메뉴는 빈 카테고리로도 옮길 수 있어야 하므로 전체 tree를 쓴다)
  const visibleTree = useMemo(
    () =>
      tree
        .map((m) => ({ ...m, children: m.children.filter((c) => counts[c.id] > 0) }))
        .filter((m) => counts[m.id] > 0),
    [tree, counts]
  );

  const visibleLinks = useMemo(() => {
    if (selected === "home") return [];
    return links.filter(
      (link) =>
        link.categoryId === selected || majorOf(categories, link.categoryId) === selected
    );
  }, [links, categories, selected]);

  const navProps = {
    tree: visibleTree,
    counts,
    selected,
    onSelect: setSelected,
    user,
    onLogin: () => setAuthOpen(true),
    onLogout: handleLogout,
    onAddCategory: addCategory,
    onRenameCategory: renameCategory,
    onDeleteCategory: deleteCategory,
  };

  return (
    <div className="min-h-dvh">
      <MobileHeader {...navProps} />
      <Sidebar {...navProps} />
      <main className="pb-24 pt-14 md:pb-0 md:pl-64 md:pt-0">
        {selected === "home" ? (
          <HomeView
            onSave={addLink}
            onNavigate={setSelected}
            categories={categories}
            user={user}
            guestCount={links.length}
            onRequestLogin={() => setAuthOpen(true)}
          />
        ) : (
          <FeedView
            key={selected}
            category={findCategory(categories, selected)}
            links={visibleLinks}
            tree={tree}
            loading={loading}
            onRemove={removeLink}
            onMove={moveLink}
          />
        )}
      </main>
      <MobileTabBar tree={visibleTree} selected={selected} onSelect={setSelected} />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        atLimit={!user && GUEST_LIMIT_ENABLED && links.length >= GUEST_LIMIT}
      />
    </div>
  );
}
