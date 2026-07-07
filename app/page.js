"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileTabBar from "@/components/MobileTabBar";
import HomeView from "@/components/HomeView";
import FeedView from "@/components/FeedView";
import AuthModal from "@/components/AuthModal";
import { buildTree, findCategory, majorOf, majorBySlug } from "@/lib/categories";
import {
  GUEST_LIMIT,
  loadGuestLinks,
  saveGuestLinks,
  loadGuestCategories,
  saveGuestCategories,
  clearGuestData,
} from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import * as db from "@/lib/db";

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
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (user && supabase) {
          let cats = await db.fetchCategories(user.id);
          if (cats.length === 0) cats = await db.createDefaultCategories(user.id);
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
      if (!user && links.length >= GUEST_LIMIT) {
        setAuthOpen(true);
        return null; // 6번째 시도 → 로그인 모달
      }

      const tree = buildTree(categories);
      const promptCategories = tree.map((m) => ({
        name: m.name,
        slug: m.slug,
        subs: m.children.map((c) => c.name),
      }));

      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, categories: promptCategories }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "링크를 저장하지 못했어요.");

      // 자동 판정(대분류) → 배치. LLM이 하위를 골랐으면 하위로, 새로 제안했으면 생성 후 배치.
      const major =
        majorBySlug(categories, data.autoCategory) ?? majorBySlug(categories, "etc");
      let categoryId = major.id;
      if (data.suggestedSub?.name) {
        const existing = categories.find(
          (c) => c.parentId === major.id && c.name === data.suggestedSub.name
        );
        if (existing) {
          categoryId = existing.id;
        } else if (data.suggestedSub.isNew) {
          const created = user
            ? await db.insertCategory(user.id, major.id, data.suggestedSub.name)
            : {
                id: crypto.randomUUID(),
                name: data.suggestedSub.name,
                slug: null,
                parentId: major.id,
                isDefault: false,
                createdAt: Date.now(),
              };
          setCategories((prev) => [...prev, created]);
          categoryId = created.id;
        }
      }

      const base = {
        url: data.url,
        title: data.title || data.domain,
        description: data.description || "",
        imageUrl: data.image || "",
        domain: data.domain,
        categoryId, // 최종 배치 (사용자가 옮길 수 있음)
        autoCategory: data.autoCategory, // 자동 판정 기록 보존 (정확도 개선용)
        classifyMethod: data.classifyMethod,
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

  // --- 카테고리 편집 (하위만 — 대분류는 자동 분류 대상이라 고정) ---
  const addCategory = useCallback(
    async (majorId, name) => {
      const category = user
        ? await db.insertCategory(user.id, majorId, name).catch((err) => {
            console.error(err);
            return null;
          })
        : {
            id: crypto.randomUUID(),
            name,
            slug: null,
            parentId: majorId,
            isDefault: false,
            createdAt: Date.now(),
          };
      if (category) setCategories((prev) => [...prev, category]);
    },
    [user]
  );

  const renameCategory = useCallback(
    (id, name) => {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      if (user) db.renameCategory(id, name).catch(console.error);
    },
    [user]
  );

  const deleteCategory = useCallback(
    (id) => {
      const category = findCategory(categories, id);
      if (!category?.parentId) return; // 대분류는 삭제 불가
      // 소속 링크는 대분류로 이동
      setLinks((prev) =>
        prev.map((l) => (l.categoryId === id ? { ...l, categoryId: category.parentId } : l))
      );
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setSelected((prev) => (prev === id ? category.parentId : prev));
      if (user) db.deleteCategory(id, category.parentId).catch(console.error);
    },
    [user, categories]
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

  const visibleLinks = useMemo(() => {
    if (selected === "home") return [];
    return links.filter(
      (link) =>
        link.categoryId === selected || majorOf(categories, link.categoryId) === selected
    );
  }, [links, categories, selected]);

  const navProps = {
    tree,
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
      <MobileTabBar tree={tree} selected={selected} onSelect={setSelected} />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        atLimit={!user && links.length >= GUEST_LIMIT}
      />
    </div>
  );
}
