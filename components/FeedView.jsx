"use client";

import { useState } from "react";
import { Inbox, Search, ArrowDownUp } from "lucide-react";
import LinkCard from "@/components/LinkCard";

// 카테고리 이동 시 검색어 초기화는 호출부의 key={selected}로 처리
export default function FeedView({ category, links, tree, loading, onRemove, onMove }) {
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? links.filter(
        (link) =>
          link.title.toLowerCase().includes(q) || link.domain.toLowerCase().includes(q)
      )
    : links;
  const sorted = [...filtered].sort((a, b) =>
    newestFirst ? b.savedAt - a.savedAt : a.savedAt - b.savedAt
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-baseline gap-2">
        <h1 className="text-xl font-bold">{category?.name ?? "전체"}</h1>
        {!loading && <span className="text-sm tabular-nums text-ink-weak">{links.length}개</span>}
      </header>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-colors focus-within:border-primary">
          <Search size={16} className="shrink-0 text-ink-weak" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·도메인 검색"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-ink-weak"
          />
        </div>
        <button
          type="button"
          onClick={() => setNewestFirst((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink-sub transition-colors hover:bg-gray-50"
        >
          <ArrowDownUp size={14} />
          {newestFirst ? "최신순" : "오래된순"}
        </button>
      </div>

      {loading ? (
        <ul className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        q ? (
          <EmptyState
            icon={Search}
            title={`"${query.trim()}" 검색 결과가 없어요`}
            body="다른 검색어로 다시 시도해보세요"
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="아직 저장된 링크가 없어요"
            body="홈에서 링크를 붙여넣으면 여기에 정리돼요"
          />
        )
      ) : (
        <ul className="mt-5 space-y-3">
          {sorted.map((link) => (
            <LinkCard key={link.id} link={link} tree={tree} onRemove={onRemove} onMove={onMove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <Icon size={24} className="text-ink-weak" />
      </div>
      <p className="mt-4 text-[15px] font-medium text-ink-sub">{title}</p>
      <p className="mt-1 text-sm text-ink-weak">{body}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <li className="flex animate-pulse gap-4 rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-4 w-3/4 rounded bg-gray-100" />
        <div className="h-3.5 w-full rounded bg-gray-100" />
        <div className="h-3 w-1/3 rounded bg-gray-100" />
      </div>
      <div className="h-20 w-28 shrink-0 rounded-xl bg-gray-100" />
    </li>
  );
}
