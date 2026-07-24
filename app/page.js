"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileTabBar from "@/components/MobileTabBar";
import HomeView from "@/components/HomeView";
import FeedView from "@/components/FeedView";
import DrawerLogin from "@/components/DrawerLogin";
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
  // 실행취소 대기 중인 링크 삭제 (토스트 표시용). 실제 DB 삭제는 유예 후 확정 시점에.
  const [pendingDelete, setPendingDelete] = useState(null); // { link }
  const pendingRef = useRef(null); // { link, user } — 확정 시 필요한 스냅샷
  const pendingTimerRef = useRef(null);

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

  // --- 링크 삭제: 즉시 화면에서 제거하되, 잠깐 실행취소 기회를 준다 ---
  // 게스트는 links state가 곧 저장소(localStorage 동기화)라 확정 시 할 일이 없고,
  // 로그인 상태만 확정 시점에 DB에서 지운다.
  const commitPendingDelete = useCallback(() => {
    clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending?.user) db.deleteLink(pending.link.id).catch(console.error);
    setPendingDelete(null);
  }, []);

  const removeLink = useCallback(
    (id) => {
      const link = links.find((l) => l.id === id);
      if (!link) return;
      commitPendingDelete(); // 이전 대기 건은 확정
      setLinks((prev) => prev.filter((l) => l.id !== id));
      pendingRef.current = { link, user };
      setPendingDelete({ link });
      pendingTimerRef.current = setTimeout(commitPendingDelete, 6000);
    },
    [links, user, commitPendingDelete]
  );

  const undoRemoveLink = useCallback(() => {
    clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) setLinks((prev) => [pending.link, ...prev]);
    setPendingDelete(null);
  }, []);

  const moveLink = useCallback(
    (id, categoryId) => {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, categoryId } : l)));
      if (user) db.updateLinkCategory(id, categoryId).catch(console.error);
    },
    [user]
  );

  // --- 카테고리 편집 (대분류·세부주제 모두 — AI 판정이 틀리면 사용자가 고친다) ---
  // 성공 여부를 반환해 사이드바가 중복 이름 등을 안내할 수 있게 한다
  const addCategory = useCallback(
    async (parentId, name) => {
      if (findByName(categories, name, parentId ?? null)) return false; // 같은 이름 중복 방지
      const category = user
        ? await db.insertCategory(user.id, parentId ?? null, name).catch((err) => {
            console.error(err);
            return null;
          })
        : guestCategory(name, parentId ?? null);
      if (!category) return false;
      setCategories((prev) =>
        findByName(prev, name, parentId ?? null) ? prev : [...prev, category]
      );
      return true;
    },
    [user, categories]
  );

  const renameCategory = useCallback(
    (id, name) => {
      const category = findCategory(categories, id);
      if (!category) return false;
      if (category.name === name) return true; // 그대로 — 변경 없음
      if (findByName(categories, name, category.parentId ?? null)) return false; // 같은 이름 중복 방지
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      if (user) db.renameCategory(id, name).catch(console.error);
      return true;
    },
    [user, categories]
  );

  // deleteLinks: true면 소속 링크도 함께 삭제, false(기본·안전)면 링크는 보존
  // — 세부주제는 대분류로, 대분류는 '기타'로 이동
  const deleteCategory = useCallback(
    async (id, { deleteLinks = false } = {}) => {
      const category = findCategory(categories, id);
      if (!category) return;

      // 세부주제
      if (category.parentId) {
        if (deleteLinks) {
          setLinks((prev) => prev.filter((l) => l.categoryId !== id));
          if (user) db.deleteCategoryTree([id], null, true).catch(console.error);
        } else {
          setLinks((prev) =>
            prev.map((l) => (l.categoryId === id ? { ...l, categoryId: category.parentId } : l))
          );
          if (user) db.deleteCategory(id, category.parentId).catch(console.error);
        }
        setCategories((prev) => prev.filter((c) => c.id !== id));
        setSelected((prev) => (prev === id ? category.parentId : prev));
        return;
      }

      // 대분류: 세부주제까지 함께 삭제
      const childIds = categories.filter((c) => c.parentId === id).map((c) => c.id);
      const removedIds = new Set([id, ...childIds]);
      const hasLinks = links.some((l) => removedIds.has(l.categoryId));

      let etc = null;
      if (hasLinks && deleteLinks) {
        setLinks((prev) => prev.filter((l) => !removedIds.has(l.categoryId)));
      } else if (hasLinks) {
        // '기타' 자체는 링크 보존 이동이 불가 (갈 곳이 없다) — UI에서 막고 여기서도 방어
        if (category.name === FALLBACK_TOPIC) return;
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
      if (user)
        db.deleteCategoryTree([id, ...childIds], etc?.id ?? null, deleteLinks).catch(console.error);
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
      {/* 링크 삭제 실행취소 토스트 */}
      {pendingDelete && (
        <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-surface py-2.5 pl-4 pr-3 shadow-lg md:bottom-8">
          <span className="whitespace-nowrap text-sm text-ink-sub">링크를 삭제했어요</span>
          <button
            type="button"
            onClick={undoRemoveLink}
            className="whitespace-nowrap rounded-lg px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary-weak"
          >
            실행취소
          </button>
        </div>
      )}
      <DrawerLogin
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        atLimit={!user && GUEST_LIMIT_ENABLED && links.length >= GUEST_LIMIT}
      />
    </div>
  );
}
